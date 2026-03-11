import {
  students, feedback, cachedResponses,
  type Student, type InsertStudent,
  type Feedback, type InsertFeedback,
  type CachedResponse,
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, or, desc, sql } from "drizzle-orm";

export interface IStorage {
  searchStudents(query: string): Promise<Student[]>;
  getStudent(id: number): Promise<Student | undefined>;
  incrementSearchCount(id: number): Promise<void>;
  getAllStudents(): Promise<Student[]>;
  createStudent(student: InsertStudent): Promise<Student>;

  getFeedback(studentId: number): Promise<Feedback[]>;
  addFeedback(feedback: InsertFeedback): Promise<Feedback>;

  getCachedResponse(studentId: number): Promise<CachedResponse | undefined>;
  saveCachedResponse(studentId: number, response: string, feedbackCount: number): Promise<CachedResponse>;

  getLeaderboard(sortBy: "searches" | "feedback", limit?: number): Promise<Student[]>;
  getStudentCount(): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async searchStudents(query: string): Promise<Student[]> {
    if (!query) return [];
    const searchPattern = `%${query}%`;
    return db.select().from(students).where(
      or(
        ilike(students.name, searchPattern),
        ilike(students.email, searchPattern),
        ilike(students.rollNumber, searchPattern),
      )
    ).limit(10);
  }

  async getStudent(id: number): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.id, id));
    return student || undefined;
  }

  async incrementSearchCount(id: number): Promise<void> {
    await db.update(students)
      .set({ searchCount: sql`${students.searchCount} + 1` })
      .where(eq(students.id, id));
  }

  async getAllStudents(): Promise<Student[]> {
    return db.select().from(students);
  }

  async createStudent(student: InsertStudent): Promise<Student> {
    const [created] = await db.insert(students).values(student).returning();
    return created;
  }

  async getFeedback(studentId: number): Promise<Feedback[]> {
    return db.select().from(feedback)
      .where(eq(feedback.studentId, studentId))
      .orderBy(desc(feedback.createdAt));
  }

  async addFeedback(fb: InsertFeedback): Promise<Feedback> {
    const [created] = await db.insert(feedback).values(fb).returning();
    await db.update(students)
      .set({ feedbackCount: sql`${students.feedbackCount} + 1` })
      .where(eq(students.id, fb.studentId));
    return created;
  }

  async getCachedResponse(studentId: number): Promise<CachedResponse | undefined> {
    const [cached] = await db.select().from(cachedResponses)
      .where(eq(cachedResponses.studentId, studentId))
      .orderBy(desc(cachedResponses.createdAt))
      .limit(1);
    return cached || undefined;
  }

  async saveCachedResponse(studentId: number, response: string, feedbackCount: number): Promise<CachedResponse> {
    const [created] = await db.insert(cachedResponses).values({
      studentId,
      response,
      feedbackCountAtGeneration: feedbackCount,
    }).returning();
    return created;
  }

  async getLeaderboard(sortBy: "searches" | "feedback", limit = 20): Promise<Student[]> {
    const orderCol = sortBy === "searches" ? students.searchCount : students.feedbackCount;
    return db.select().from(students)
      .where(sortBy === "searches" ? sql`${students.searchCount} > 0` : sql`${students.feedbackCount} > 0`)
      .orderBy(desc(orderCol)).limit(limit);
  }

  async getStudentCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(students);
    return Number(result[0]?.count ?? 0);
  }
}

export const storage = new DatabaseStorage();
