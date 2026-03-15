import { sql } from "drizzle-orm";
import { pgTable, serial, text, integer, timestamp, varchar, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/chat";

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  rollNumber: text("roll_number"),
  phone: text("phone"),
  pictureUrl: text("picture_url"),
  searchCount: integer("search_count").default(0).notNull(),
  feedbackCount: integer("feedback_count").default(0).notNull(),
  profileStrength: integer("profile_strength"),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  googleId: text("google_id").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  pictureUrl: text("picture_url"),
  studentId: integer("student_id").references(() => students.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const socialLinks = pgTable("social_links", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  url: text("url").notNull(),
});

export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  authorName: text("author_name"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const cachedResponses = pgTable("cached_responses", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  response: text("response").notNull(),
  ratings: text("ratings"),
  feedbackCountAtGeneration: integer("feedback_count_at_generation").default(0).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  ipHash: text("ip_hash").notNull(),
  date: text("date").notNull(),
}, (t) => [unique().on(t.ipHash, t.date)]);

export const emailNotifications = pgTable("email_notifications", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  emailType: text("email_type").notNull(),
  weekKey: text("week_key").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const analysisReactions = pgTable("analysis_reactions", {
  id: serial("id").primaryKey(),
  cachedResponseId: integer("cached_response_id").notNull().references(() => cachedResponses.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  reaction: text("reaction").notNull(),
  chips: text("chips").array(),
  implicit: text("implicit"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const studentsRelations = relations(students, ({ many }) => ({
  feedback: many(feedback),
  cachedResponses: many(cachedResponses),
  socialLinks: many(socialLinks),
}));

export const usersRelations = relations(users, ({ one }) => ({
  student: one(students, { fields: [users.studentId], references: [students.id] }),
}));

export const socialLinksRelations = relations(socialLinks, ({ one }) => ({
  student: one(students, { fields: [socialLinks.studentId], references: [students.id] }),
}));

export const feedbackRelations = relations(feedback, ({ one }) => ({
  student: one(students, { fields: [feedback.studentId], references: [students.id] }),
}));

export const cachedResponsesRelations = relations(cachedResponses, ({ one }) => ({
  student: one(students, { fields: [cachedResponses.studentId], references: [students.id] }),
}));

export const personalityRatings = pgTable("personality_ratings", {
  id: serial("id").primaryKey(),
  raterId: integer("rater_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rateeId: integer("ratee_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  trait: text("trait").notNull(),
  score: integer("score").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (t) => [unique().on(t.raterId, t.rateeId, t.trait)]);

export const analysisReactionsRelations = relations(analysisReactions, ({ one }) => ({
  cachedResponse: one(cachedResponses, { fields: [analysisReactions.cachedResponseId], references: [cachedResponses.id] }),
  student: one(students, { fields: [analysisReactions.studentId], references: [students.id] }),
}));

export const personalityRatingsRelations = relations(personalityRatings, ({ one }) => ({
  rater: one(users, { fields: [personalityRatings.raterId], references: [users.id] }),
  ratee: one(students, { fields: [personalityRatings.rateeId], references: [students.id] }),
}));

export const insertStudentSchema = createInsertSchema(students).omit({
  id: true,
  searchCount: true,
  feedbackCount: true,
});

export const insertFeedbackSchema = createInsertSchema(feedback).omit({
  id: true,
  createdAt: true,
});

export const insertSocialLinkSchema = createInsertSchema(socialLinks).omit({
  id: true,
});

export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type CachedResponse = typeof cachedResponses.$inferSelect;
export type User = typeof users.$inferSelect;
export type SocialLink = typeof socialLinks.$inferSelect;
export type InsertSocialLink = z.infer<typeof insertSocialLinkSchema>;
export type AnalysisReaction = typeof analysisReactions.$inferSelect;
export type PersonalityRating = typeof personalityRatings.$inferSelect;

export const PERSONALITY_TRAITS = [
  { key: "funny",           label: "Funny",           emoji: "😂" },
  { key: "charming",        label: "Charming",         emoji: "✨" },
  { key: "charismatic",     label: "Charismatic",      emoji: "⚡" },
  { key: "empathetic",      label: "Empathetic",       emoji: "💙" },
  { key: "arrogant",        label: "Arrogant",         emoji: "😤" },
  { key: "mysterious",      label: "Mysterious",       emoji: "🌙" },
  { key: "intense",         label: "Intense",          emoji: "🔥" },
  { key: "brutally_honest", label: "Brutally Honest",  emoji: "🎯" },
] as const;

export type PersonalityTraitKey = typeof PERSONALITY_TRAITS[number]["key"];
