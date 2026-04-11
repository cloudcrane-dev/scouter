import { db } from "./db";
import { students } from "@shared/schema";
import { sql } from "drizzle-orm";
import { readFileSync } from "fs";
import { resolve } from "path";

async function runMigrations() {
  try {
    await db.execute(sql`
      ALTER TABLE students ADD COLUMN IF NOT EXISTS upvote_count integer NOT NULL DEFAULT 0
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS resumes (
        id serial PRIMARY KEY,
        student_id integer NOT NULL REFERENCES students(id) ON DELETE CASCADE UNIQUE,
        file_name text NOT NULL,
        mime_type text NOT NULL,
        data text NOT NULL,
        score integer,
        improvements text,
        updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS upvotes (
        id serial PRIMARY KEY,
        voter_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        student_id integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE(voter_id, student_id)
      )
    `);

    console.log("Schema migrations applied successfully.");
  } catch (err) {
    console.error("Migration error (non-fatal):", err);
  }
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function extractRollNumber(name: string): { cleanName: string; rollNumber: string | null } {
  // handles multiple roll numbers like (M24DE3001)(G23AI2004) — takes first
  const match = name.match(/^(.+?)\s*\(([A-Z0-9]+)\)/);
  if (match) {
    return { cleanName: match[1].trim(), rollNumber: match[2] };
  }
  return { cleanName: name.trim(), rollNumber: null };
}

function isLikelyStudent(name: string, email: string, rollNumber: string | null): boolean {
  if (rollNumber) return true;
  const studentEmailPattern = /^[a-z]\d{2}|^ug\d|^pg\d/i;
  if (studentEmailPattern.test(email.split("@")[0])) return true;
  const institutionalKeywords = [
    "symposium", "dean", "associate dean", "department", "office",
    "accounts", "library", "hostel office", "placement", "registrar",
    "director", "committee", "cell", "centre", "center", "club",
    "fest", "annual", "national", "international",
  ];
  const lowerName = name.toLowerCase();
  for (const kw of institutionalKeywords) {
    if (lowerName.includes(kw)) return false;
  }
  return true;
}

export async function seedDatabase() {
  await runMigrations();
  try {
    const csvPath = resolve(process.cwd(), "contacts-1.csv");
    let csvData: string;
    try {
      csvData = readFileSync(csvPath, "utf-8");
    } catch {
      const existing = await db.select({ count: sql<number>`count(*)` }).from(students);
      const count = Number(existing[0]?.count ?? 0);
      console.log(`No CSV found. Database has ${count} students.`);
      return;
    }

    const lines = csvData.split("\n").filter(l => l.trim());
    if (lines.length < 2) {
      console.log("CSV file is empty or has no data rows.");
      return;
    }

    const dataLines = lines.slice(1);
    const records: {
      name: string;
      email: string;
      rollNumber: string | null;
      phone: string | null;
      pictureUrl: string | null;
    }[] = [];

    const seenEmails = new Set<string>();

    for (const line of dataLines) {
      const fields = parseCSVLine(line);
      if (fields.length < 2) continue;

      const rawName = fields[0] || "";
      const email = (fields[1] || "").trim().toLowerCase();
      const phone = (fields[2] || "").trim() || null;
      let pictureUrl = (fields[3] || "").trim() || null;

      if (!rawName || !email) continue;
      if (seenEmails.has(email)) continue;
      seenEmails.add(email);

      const { cleanName, rollNumber } = extractRollNumber(rawName);

      if (!isLikelyStudent(cleanName, email, rollNumber)) continue;

      if (pictureUrl) {
        pictureUrl = pictureUrl.replace(/=s\d+-/, "=s400-");
      }

      records.push({
        name: cleanName,
        email,
        rollNumber,
        phone,
        pictureUrl,
      });
    }

    console.log(`Parsed ${records.length} student records from CSV.`);

    const existing = await db.select({ count: sql<number>`count(*)` }).from(students);
    const existingCount = Number(existing[0]?.count ?? 0);

    if (existingCount === 0) {
      console.log("Empty database — seeding from CSV.");
    } else {
      const newCount = records.length - existingCount;
      if (newCount <= 0) {
        console.log(`Database already has ${existingCount} students. Skipping CSV import.`);
        return;
      }
      console.log(`Database has ${existingCount} students; CSV has ${records.length} — importing ${newCount} new records.`);
    }

    const BATCH_SIZE = 200;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      await db.insert(students).values(batch).onConflictDoNothing({ target: students.email });
    }

    const final = await db.select({ count: sql<number>`count(*)` }).from(students);
    console.log(`Seeded ${Number(final[0]?.count ?? 0)} students into database.`);
  } catch (error) {
    console.error("Seed error:", error);
  }
}
