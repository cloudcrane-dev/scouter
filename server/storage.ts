import {
  students, feedback, cachedResponses, users, socialLinks, analyticsEvents,
  type Student, type InsertStudent,
  type Feedback, type InsertFeedback,
  type CachedResponse,
  type User, type SocialLink, type InsertSocialLink,
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, or, desc, sql, and } from "drizzle-orm";
import { createHash } from "crypto";

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export function computeProfileStrength(ratings: Record<string, number>): number {
  const keys = ["onlinePresence", "codingActivity", "realWorldExperience", "profileCompleteness"];
  const sum = keys.reduce((acc, k) => acc + (ratings[k] ?? 1), 0);
  return Math.round((sum / (keys.length * 5)) * 100);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

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
  saveCachedResponse(studentId: number, response: string, feedbackCount: number, ratings?: string): Promise<CachedResponse>;

  getLeaderboard(sortBy: "searches" | "feedback" | "strength", limit?: number): Promise<Student[]>;
  getStudentCount(): Promise<number>;

  findUserByGoogleId(googleId: string): Promise<User | undefined>;
  findUserByEmail(email: string): Promise<User | undefined>;
  createUser(data: { googleId: string; email: string; name: string; pictureUrl?: string; studentId?: number }): Promise<User>;
  getUserByStudentId(studentId: number): Promise<User | undefined>;

  updateUserStudentId(userId: number, studentId: number): Promise<void>;

  getSocialLinks(studentId: number): Promise<SocialLink[]>;
  setSocialLinks(studentId: number, links: { platform: string; url: string }[]): Promise<SocialLink[]>;
  invalidateCache(studentId: number): Promise<void>;

  recordVisit(ip: string): Promise<void>;
  getDailyActiveUsers(): Promise<number>;
  getMonthlyActiveUsers(): Promise<number>;
  getVerifiedActiveUsers(): Promise<number>;
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

  async saveCachedResponse(studentId: number, response: string, feedbackCount: number, ratings?: string): Promise<CachedResponse> {
    const [created] = await db.insert(cachedResponses).values({
      studentId,
      response,
      ratings: ratings ?? null,
      feedbackCountAtGeneration: feedbackCount,
    }).returning();

    if (ratings) {
      try {
        const parsed = JSON.parse(ratings) as Record<string, number>;
        const strength = computeProfileStrength(parsed);
        await db.update(students).set({ profileStrength: strength }).where(eq(students.id, studentId));
      } catch { /* ignore parse errors */ }
    }

    return created;
  }

  async getLeaderboard(sortBy: "searches" | "feedback" | "strength", limit = 20): Promise<Student[]> {
    if (sortBy === "strength") {
      return db.select().from(students)
        .where(sql`${students.profileStrength} IS NOT NULL`)
        .orderBy(desc(students.profileStrength)).limit(limit);
    }
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

  async updateUserStudentId(userId: number, studentId: number): Promise<void> {
    await db.update(users).set({ studentId }).where(eq(users.id, userId));
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

  async recordVisit(ip: string): Promise<void> {
    const ipHash = hashIp(ip);
    const date = todayStr();
    await db.insert(analyticsEvents)
      .values({ ipHash, date })
      .onConflictDoNothing();
  }

  async getDailyActiveUsers(): Promise<number> {
    const today = todayStr();
    const result = await db
      .selectDistinct({ ipHash: analyticsEvents.ipHash })
      .from(analyticsEvents)
      .where(eq(analyticsEvents.date, today));
    return result.length;
  }

  async getMonthlyActiveUsers(): Promise<number> {
    const cutoff = daysAgoStr(30);
    const result = await db
      .selectDistinct({ ipHash: analyticsEvents.ipHash })
      .from(analyticsEvents)
      .where(sql`${analyticsEvents.date} >= ${cutoff}`);
    return result.length;
  }

  async getVerifiedActiveUsers(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`${users.studentId} IS NOT NULL`);
    return Number(result[0]?.count ?? 0);
  }
}

export const storage = new DatabaseStorage();
