import {
  students, resumeRatings, studentResumes, profileUpvotes, cachedResponses,
  type Student, type InsertStudent,
  type ResumeRating, type InsertResumeRating,
  type StudentResume, type InsertStudentResume,
  type ProfileUpvote, type InsertProfileUpvote,
  type CachedResponse,
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, or, desc, sql, and } from "drizzle-orm";

export interface IStorage {
  searchStudents(query: string): Promise<Student[]>;
  getStudent(id: number): Promise<Student | undefined>;
  incrementSearchCount(id: number): Promise<void>;
  getAllStudents(): Promise<Student[]>;
  createStudent(student: InsertStudent): Promise<Student>;

  getLatestResumeRating(studentId: number, reviewerHandle: string): Promise<ResumeRating | undefined>;
  addResumeRating(rating: InsertResumeRating): Promise<ResumeRating>;

  listStudentResumes(studentId: number): Promise<StudentResume[]>;
  addStudentResume(resume: InsertStudentResume): Promise<StudentResume>;
  getStudentResumeById(studentId: number, resumeId: number): Promise<StudentResume | undefined>;

  hasUpvoted(studentId: number, voterHandle: string): Promise<boolean>;
  addUpvote(upvote: InsertProfileUpvote): Promise<ProfileUpvote>;

  getCachedResponse(studentId: number): Promise<CachedResponse | undefined>;
  saveCachedResponse(studentId: number, response: string): Promise<CachedResponse>;

  getLeaderboard(sortBy: "searches" | "upvotes", limit?: number): Promise<Student[]>;
  getStudentCount(): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async searchStudents(query: string): Promise<Student[]> {
    const searchPattern = `%${query}%`;
    return db.select().from(students).where(
      or(
        ilike(students.name, searchPattern),
        ilike(students.email, searchPattern),
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

  async getLatestResumeRating(studentId: number, reviewerHandle: string): Promise<ResumeRating | undefined> {
    const [latest] = await db.select().from(resumeRatings)
      .where(and(eq(resumeRatings.studentId, studentId), eq(resumeRatings.reviewerHandle, reviewerHandle)))
      .orderBy(desc(resumeRatings.createdAt))
      .limit(1);
    return latest || undefined;
  }

  async addResumeRating(rating: InsertResumeRating): Promise<ResumeRating> {
    const [created] = await db.insert(resumeRatings).values(rating).returning();
    return created;
  }

  async listStudentResumes(studentId: number): Promise<StudentResume[]> {
    return db.select().from(studentResumes)
      .where(eq(studentResumes.studentId, studentId))
      .orderBy(desc(studentResumes.createdAt));
  }

  async addStudentResume(resume: InsertStudentResume): Promise<StudentResume> {
    const [created] = await db.insert(studentResumes).values(resume).returning();
    return created;
  }

  async getStudentResumeById(studentId: number, resumeId: number): Promise<StudentResume | undefined> {
    const [found] = await db.select().from(studentResumes)
      .where(and(eq(studentResumes.studentId, studentId), eq(studentResumes.id, resumeId)))
      .limit(1);
    return found || undefined;
  }

  async hasUpvoted(studentId: number, voterHandle: string): Promise<boolean> {
    const [existing] = await db.select({ id: profileUpvotes.id })
      .from(profileUpvotes)
      .where(and(eq(profileUpvotes.studentId, studentId), eq(profileUpvotes.voterHandle, voterHandle)))
      .limit(1);
    return Boolean(existing);
  }

  async addUpvote(upvote: InsertProfileUpvote): Promise<ProfileUpvote> {
    const [created] = await db.insert(profileUpvotes).values(upvote).returning();
    await db.update(students)
      .set({ upvoteCount: sql`${students.upvoteCount} + 1` })
      .where(eq(students.id, upvote.studentId));
    return created;
  }

  async getCachedResponse(studentId: number): Promise<CachedResponse | undefined> {
    const [cached] = await db.select().from(cachedResponses)
      .where(eq(cachedResponses.studentId, studentId))
      .orderBy(desc(cachedResponses.createdAt))
      .limit(1);
    return cached || undefined;
  }

  async saveCachedResponse(studentId: number, response: string): Promise<CachedResponse> {
    const [created] = await db.insert(cachedResponses).values({
      studentId,
      response,
    }).returning();
    return created;
  }

  async getLeaderboard(sortBy: "searches" | "upvotes", limit = 20): Promise<Student[]> {
    const orderCol = sortBy === "searches" ? students.searchCount : students.upvoteCount;
    return db.select().from(students).orderBy(desc(orderCol)).limit(limit);
  }

  async getStudentCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(students);
    return Number(result[0]?.count ?? 0);
  }
}

export const storage = new DatabaseStorage();
