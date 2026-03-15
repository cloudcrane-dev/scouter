import { db } from "./db";
import { cachedResponses, students } from "@shared/schema";
import { eq, isNotNull, sql } from "drizzle-orm";
import { computeProfileStrength } from "./storage";

async function migrateRatingsTo10Scale() {
  const KEYS = ["onlinePresence", "codingActivity", "realWorldExperience", "profileCompleteness"];

  const rows = await db.select().from(cachedResponses).where(isNotNull(cachedResponses.ratings));

  let backfilled = 0;
  for (const row of rows) {
    if (!row.ratings) continue;
    try {
      const parsed = JSON.parse(row.ratings) as Record<string, number>;

      const maxVal = Math.max(...KEYS.map(k => parsed[k] ?? 1));
      if (maxVal > 5) {
        continue;
      }

      const doubled: Record<string, number> = {};
      for (const k of KEYS) {
        doubled[k] = Math.min(10, (parsed[k] ?? 1) * 2);
      }

      await db.update(cachedResponses)
        .set({ ratings: JSON.stringify(doubled) })
        .where(eq(cachedResponses.id, row.id));

      const strength = computeProfileStrength(doubled);
      await db.update(students)
        .set({ profileStrength: strength })
        .where(eq(students.id, row.studentId));

      backfilled++;
    } catch {
    }
  }

  console.log(`Backfilled ${backfilled} cached ratings (1-5 → 1-10)`);

  const deleted = await db.delete(cachedResponses).returning();
  console.log(`Invalidated ${deleted.length} cached responses`);

  await db.update(students).set({ profileStrength: null });
  console.log("Cleared all profileStrength values (will recompute on next scan)");
}

migrateRatingsTo10Scale()
  .then(() => { console.log("Migration complete"); process.exit(0); })
  .catch((e) => { console.error("Migration failed:", e); process.exit(1); });
