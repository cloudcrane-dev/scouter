import { db } from "./db";
import { students } from "@shared/schema";
import { sql } from "drizzle-orm";

const sampleStudents = [
  {
    name: "Aarav Sharma",
    email: "aarav.sharma@iitj.ac.in",
    phone: "+91 98765 43210",
    pictureUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=aarav",
  },
  {
    name: "Priya Patel",
    email: "priya.patel@iitj.ac.in",
    phone: "+91 98765 43211",
    pictureUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=priya",
  },
  {
    name: "Chirag Mehta",
    email: "chirag.mehta@iitj.ac.in",
    phone: "+91 98765 43212",
    pictureUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=chirag",
  },
  {
    name: "Ananya Reddy",
    email: "ananya.reddy@iitj.ac.in",
    phone: "+91 98765 43213",
    pictureUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=ananya",
  },
  {
    name: "Rohan Gupta",
    email: "rohan.gupta@iitj.ac.in",
    phone: "+91 98765 43214",
    pictureUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=rohan",
  },
  {
    name: "Sneha Iyer",
    email: "sneha.iyer@iitj.ac.in",
    phone: "+91 98765 43215",
    pictureUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=sneha",
  },
  {
    name: "Vikram Singh",
    email: "vikram.singh@iitj.ac.in",
    phone: "+91 98765 43216",
    pictureUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=vikram",
  },
  {
    name: "Kavya Nair",
    email: "kavya.nair@iitj.ac.in",
    phone: "+91 98765 43217",
    pictureUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=kavya",
  },
  {
    name: "Arjun Desai",
    email: "arjun.desai@iitj.ac.in",
    phone: "+91 98765 43218",
    pictureUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=arjun",
  },
  {
    name: "Meera Joshi",
    email: "meera.joshi@iitj.ac.in",
    phone: "+91 98765 43219",
    pictureUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=meera",
  },
];

export async function seedDatabase() {
  try {
    const existing = await db.select({ count: sql<number>`count(*)` }).from(students);
    const count = Number(existing[0]?.count ?? 0);

    if (count === 0) {
      console.log("Seeding database with sample students...");
      await db.insert(students).values(sampleStudents);
      console.log(`Seeded ${sampleStudents.length} students.`);
    } else {
      console.log(`Database already has ${count} students. Skipping seed.`);
    }
  } catch (error) {
    console.error("Seed error:", error);
  }
}
