import {
  students, feedback, cachedResponses, users, socialLinks, analyticsEvents, analysisReactions, emailNotifications, personalityRatings,
  PERSONALITY_TRAITS,
  type Student, type InsertStudent,
  type Feedback, type InsertFeedback,
  type CachedResponse,
  type User, type SocialLink, type InsertSocialLink,
  type AnalysisReaction,
} from "@shared/schema";

export type LeaderboardEntry = Student & { verified: boolean };
export type PersonalityEntry = {
  id: number; name: string; email: string; rollNumber: string | null;
  pictureUrl: string | null; searchCount: number; feedbackCount: number; profileStrength: number | null;
  personalityScore: number; raterCount: number; verified: boolean;
  topTraits: { trait: string; label: string; emoji: string; score: number }[];
};
export type PersonalityData = {
  traits: { key: string; label: string; emoji: string; avgScore: number }[];
  totalScore: number; raterCount: number;
  myRating: Record<string, number> | null;
};
import { db } from "./db";
import { eq, ilike, or, desc, sql, and } from "drizzle-orm";
import { createHash } from "crypto";

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export function computeProfileStrength(ratings: Record<string, number>): number {
  const keys = ["onlinePresence", "codingActivity", "realWorldExperience", "profileCompleteness"];
  const sum = keys.reduce((acc, k) => acc + (ratings[k] ?? 1), 0);
  return Math.round((sum / (keys.length * 10)) * 100);
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
  updateStudentPicture(studentId: number, pictureUrl: string): Promise<void>;
  invalidateCache(studentId: number): Promise<void>;

  recordVisit(ip: string): Promise<void>;
  getDailyActiveUsers(): Promise<number>;
  getMonthlyActiveUsers(): Promise<number>;
  getVerifiedActiveUsers(): Promise<number>;

  addAnalysisReaction(data: { cachedResponseId: number; studentId: number; reaction: string; chips?: string[] | null; implicit?: string | null }): Promise<AnalysisReaction>;
  getReactionSummary(studentId: number): Promise<{ up: number; down: number; chips: Record<string, number>; latestChips: string[] }>;
  getPriorReactionContext(studentId: number): Promise<string>;

  getBottomStrengthStudents(limit?: number): Promise<Student[]>;
  hasEmailBeenSent(studentId: number, emailType: string, weekKey: string): Promise<boolean>;
  recordEmailSent(studentId: number, emailType: string, weekKey: string): Promise<void>;

  getLeaderboardWithVerified(sortBy: "searches" | "feedback" | "strength", limit?: number): Promise<LeaderboardEntry[]>;
  submitPersonalityRatings(raterId: number, rateeId: number, ratings: { trait: string; score: number }[]): Promise<void>;
  getPersonalityData(rateeId: number, raterId?: number): Promise<PersonalityData>;
  getPersonalityLeaderboard(limit?: number): Promise<PersonalityEntry[]>;
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
        await db.update(students).set({ profileStrength: strength }).where(
          and(eq(students.id, studentId), sql`(${students.profileStrength} IS NULL OR ${students.profileStrength} < ${strength})`)
        );
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

  async updateStudentPicture(studentId: number, pictureUrl: string): Promise<void> {
    await db.update(students).set({ pictureUrl }).where(eq(students.id, studentId));
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

  async addAnalysisReaction(data: {
    cachedResponseId: number;
    studentId: number;
    reaction: string;
    chips?: string[] | null;
    implicit?: string | null;
  }): Promise<AnalysisReaction> {
    const [created] = await db.insert(analysisReactions).values({
      cachedResponseId: data.cachedResponseId,
      studentId: data.studentId,
      reaction: data.reaction,
      chips: data.chips ?? null,
      implicit: data.implicit ?? null,
    }).returning();
    return created;
  }

  async getReactionSummary(studentId: number): Promise<{ up: number; down: number; chips: Record<string, number>; latestChips: string[] }> {
    const rows = await db.select().from(analysisReactions)
      .where(and(eq(analysisReactions.studentId, studentId), sql`${analysisReactions.implicit} IS NULL`))
      .orderBy(desc(analysisReactions.createdAt));

    let up = 0, down = 0;
    const chips: Record<string, number> = {};
    let latestChips: string[] = [];

    for (const row of rows) {
      if (row.reaction === "up") up++;
      else if (row.reaction === "down") {
        down++;
        if (row.chips) {
          for (const c of row.chips) chips[c] = (chips[c] ?? 0) + 1;
          if (latestChips.length === 0) latestChips = row.chips;
        }
      }
    }
    return { up, down, chips, latestChips };
  }

  async getBottomStrengthStudents(limit = 50): Promise<Student[]> {
    return db.select().from(students)
      .where(sql`${students.profileStrength} IS NOT NULL AND ${students.email} IS NOT NULL`)
      .orderBy(students.profileStrength)
      .limit(limit);
  }

  async hasEmailBeenSent(studentId: number, emailType: string, weekKey: string): Promise<boolean> {
    const [row] = await db.select().from(emailNotifications)
      .where(and(
        eq(emailNotifications.studentId, studentId),
        eq(emailNotifications.emailType, emailType),
        eq(emailNotifications.weekKey, weekKey)
      ));
    return !!row;
  }

  async recordEmailSent(studentId: number, emailType: string, weekKey: string): Promise<void> {
    await db.insert(emailNotifications)
      .values({ studentId, emailType, weekKey })
      .onConflictDoNothing();
  }

  async getLeaderboardWithVerified(sortBy: "searches" | "feedback" | "strength", limit = 20): Promise<LeaderboardEntry[]> {
    const whereExpr = sortBy === "strength"
      ? sql`${students.profileStrength} IS NOT NULL`
      : sortBy === "searches" ? sql`${students.searchCount} > 0` : sql`${students.feedbackCount} > 0`;
    const orderExpr = sortBy === "strength" ? desc(students.profileStrength)
      : sortBy === "searches" ? desc(students.searchCount) : desc(students.feedbackCount);
    const rows = await db.select({
      id: students.id, name: students.name, email: students.email, rollNumber: students.rollNumber,
      phone: students.phone, pictureUrl: students.pictureUrl, searchCount: students.searchCount,
      feedbackCount: students.feedbackCount, profileStrength: students.profileStrength,
      userId: users.id,
    }).from(students).leftJoin(users, eq(users.studentId, students.id)).where(whereExpr).orderBy(orderExpr).limit(limit);
    return rows.map(({ userId, ...r }) => ({ ...r, verified: userId != null })) as LeaderboardEntry[];
  }

  async submitPersonalityRatings(raterId: number, rateeId: number, ratings: { trait: string; score: number }[]): Promise<void> {
    const validKeys = new Set(PERSONALITY_TRAITS.map(t => t.key));
    const valid = ratings.filter(r => validKeys.has(r.trait) && r.score >= 1 && r.score <= 5);
    if (valid.length === 0) return;
    await db.insert(personalityRatings)
      .values(valid.map(r => ({ raterId, rateeId, trait: r.trait, score: r.score })))
      .onConflictDoUpdate({
        target: [personalityRatings.raterId, personalityRatings.rateeId, personalityRatings.trait],
        set: { score: sql`excluded.score`, createdAt: sql`CURRENT_TIMESTAMP` },
      });
  }

  async getPersonalityData(rateeId: number, raterId?: number): Promise<PersonalityData> {
    const rows = await db.select({
      trait: personalityRatings.trait,
      score: personalityRatings.score,
      rater: personalityRatings.raterId,
    }).from(personalityRatings).where(eq(personalityRatings.rateeId, rateeId));

    const traitTotals: Record<string, { sum: number; count: number }> = {};
    const raterSet = new Set<number>();
    const myRatingMap: Record<string, number> = {};

    for (const row of rows) {
      raterSet.add(row.rater);
      if (!traitTotals[row.trait]) traitTotals[row.trait] = { sum: 0, count: 0 };
      traitTotals[row.trait].sum += row.score;
      traitTotals[row.trait].count++;
      if (raterId && row.rater === raterId) myRatingMap[row.trait] = row.score;
    }

    const traits = PERSONALITY_TRAITS.map(t => ({
      key: t.key, label: t.label, emoji: t.emoji,
      avgScore: traitTotals[t.key] ? traitTotals[t.key].sum / traitTotals[t.key].count : 0,
    }));

    const ratedTraits = traits.filter(t => t.avgScore > 0);
    const totalScore = ratedTraits.length > 0
      ? Math.round((ratedTraits.reduce((s, t) => s + t.avgScore, 0) / ratedTraits.length) / 5 * 100)
      : 0;

    return {
      traits,
      totalScore,
      raterCount: raterSet.size,
      myRating: Object.keys(myRatingMap).length > 0 ? myRatingMap : null,
    };
  }

  async getPersonalityLeaderboard(limit = 20): Promise<PersonalityEntry[]> {
    const rows = await db.select({
      rateeId: personalityRatings.rateeId,
      trait: personalityRatings.trait,
      avgScore: sql<number>`AVG(${personalityRatings.score})`,
      raterCount: sql<number>`COUNT(DISTINCT ${personalityRatings.raterId})`,
    }).from(personalityRatings)
      .groupBy(personalityRatings.rateeId, personalityRatings.trait);

    const byStudent: Record<number, { traits: Record<string, number>; raterCount: number }> = {};
    for (const row of rows) {
      if (!byStudent[row.rateeId]) byStudent[row.rateeId] = { traits: {}, raterCount: Number(row.raterCount) };
      byStudent[row.rateeId].traits[row.trait] = Number(row.avgScore);
      byStudent[row.rateeId].raterCount = Math.max(byStudent[row.rateeId].raterCount, Number(row.raterCount));
    }

    const studentIds = Object.keys(byStudent).map(Number);
    if (studentIds.length === 0) return [];

    const studentRows = await db.select({
      id: students.id, name: students.name, email: students.email, rollNumber: students.rollNumber,
      pictureUrl: students.pictureUrl, searchCount: students.searchCount, feedbackCount: students.feedbackCount,
      profileStrength: students.profileStrength, phone: students.phone,
      userId: users.id,
    }).from(students).leftJoin(users, eq(users.studentId, students.id)).where(sql`${students.id} = ANY(ARRAY[${sql.raw(studentIds.join(","))}]::int[])`);

    const entries: PersonalityEntry[] = studentRows.map(s => {
      const data = byStudent[s.id];
      const ratedTraits = Object.entries(data.traits).filter(([, v]) => v > 0);
      const totalScore = ratedTraits.length > 0
        ? Math.round((ratedTraits.reduce((sum, [, v]) => sum + v, 0) / ratedTraits.length) / 5 * 100)
        : 0;
      const topTraits = PERSONALITY_TRAITS
        .filter(t => data.traits[t.key] != null)
        .map(t => ({ trait: t.key, label: t.label, emoji: t.emoji, score: Number((data.traits[t.key]).toFixed(1)) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      return {
        id: s.id, name: s.name, email: s.email, rollNumber: s.rollNumber,
        pictureUrl: s.pictureUrl, searchCount: s.searchCount, feedbackCount: s.feedbackCount,
        profileStrength: s.profileStrength, personalityScore: totalScore,
        raterCount: data.raterCount, verified: s.userId != null, topTraits,
      };
    }).sort((a, b) => b.personalityScore - a.personalityScore).slice(0, limit);

    return entries;
  }

  async getPriorReactionContext(studentId: number): Promise<string> {
    const { down, chips } = await this.getReactionSummary(studentId);
    if (down === 0 && Object.keys(chips).length === 0) return "";

    const lines: string[] = [];
    if (chips["too_vague"] >= 1) {
      lines.push("IMPORTANT: Previous analyses for this student were flagged as 'too vague'. Be hyper-specific — cite exact repo names, commit counts, LeetCode problem counts, job titles, project names. Never use filler phrases like 'seems active' without data.");
    }
    if (chips["wrong_person"] >= 1) {
      lines.push("CRITICAL: A previous analysis was flagged as 'wrong person' — the AI confused this student with someone else. You MUST anchor every single claim to this student's exact name, roll number, or @iitj.ac.in email. If you can't verify a fact belongs to them specifically, omit it entirely.");
    }
    if (chips["outdated"] >= 1) {
      lines.push("NOTE: Previous analyses were flagged as 'outdated'. Prioritise the most recent web results and social data. Note when something was last updated or when information appears stale.");
    }
    if (chips["missing_info"] >= 1) {
      lines.push("NOTE: Previous analyses were flagged as 'missing info'. Explicitly state what data was and wasn't found rather than omitting gaps. If a platform has no data, call it out directly in Improvement Areas.");
    }
    return lines.join("\n");
  }
}

export const storage = new DatabaseStorage();
