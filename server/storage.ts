import {
  students, feedback, cachedResponses, users, socialLinks,
  type Student, type InsertStudent,
  type Feedback, type InsertFeedback,
  type CachedResponse,
  type User, type SocialLink, type InsertSocialLink,
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, or, desc, sql, and } from "drizzle-orm";

export interface IStorage {
  searchStudents(query: string): Promise<Student[]>;
  getStudent(id: number): Promise<Student | undefined>;
  getStudentByEmail(email: string): Promise<Student | undefined>;
  incrementSearchCount(id: number): Promise<void>;
  getAllStudents(): Promise<Student[]>;
  createStudent(student: InsertStudent): Promise<Student>;

  getFeedback(studentId: number): Promise<Feedback[]>;
  addFeedback(feedback: InsertFeedback): Promise<Feedback>;

  getCachedResponse(studentId: number): Promise<CachedResponse | undefined>;
  saveCachedResponse(studentId: number, response: string, feedbackCount: number): Promise<CachedResponse>;

  getLeaderboard(sortBy: "searches" | "feedback", limit?: number): Promise<Student[]>;
  getStudentCount(): Promise<number>;

  findUserByGoogleId(googleId: string): Promise<User | undefined>;
  findUserByEmail(email: string): Promise<User | undefined>;
  createUser(data: { googleId: string; email: string; name: string; pictureUrl?: string; studentId?: number }): Promise<User>;
  getUserByStudentId(studentId: number): Promise<User | undefined>;

  getSocialLinks(studentId: number): Promise<SocialLink[]>;
  setSocialLinks(studentId: number, links: { platform: string; url: string }[]): Promise<SocialLink[]>;
  invalidateCache(studentId: number): Promise<void>;
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

  async getStudentByEmail(email: string): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.email, email.toLowerCase()));
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

  async findUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user || undefined;
  }

  async findUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user || undefined;
  }

  async createUser(data: { googleId: string; email: string; name: string; pictureUrl?: string; studentId?: number }): Promise<User> {
    const [created] = await db.insert(users).values({
      googleId: data.googleId,
      email: data.email.toLowerCase(),
      name: data.name,
      pictureUrl: data.pictureUrl || null,
      studentId: data.studentId || null,
    }).returning();
    return created;
  }

  async getUserByStudentId(studentId: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.studentId, studentId));
    return user || undefined;
  }

  async getSocialLinks(studentId: number): Promise<SocialLink[]> {
    return db.select().from(socialLinks).where(eq(socialLinks.studentId, studentId));
  }

  async setSocialLinks(studentId: number, links: { platform: string; url: string }[]): Promise<SocialLink[]> {
    await db.delete(socialLinks).where(eq(socialLinks.studentId, studentId));
    if (links.length === 0) return [];
    const values = links.map(l => ({ studentId, platform: l.platform, url: l.url }));
    return db.insert(socialLinks).values(values).returning();
  }

  async invalidateCache(studentId: number): Promise<void> {
    await db.delete(cachedResponses).where(eq(cachedResponses.studentId, studentId));
  }
}

export const storage = new DatabaseStorage();
