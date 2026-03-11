import { sql } from "drizzle-orm";
import { pgTable, serial, text, integer, timestamp, varchar } from "drizzle-orm/pg-core";
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
  feedbackCountAtGeneration: integer("feedback_count_at_generation").default(0).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const studentsRelations = relations(students, ({ many }) => ({
  feedback: many(feedback),
  cachedResponses: many(cachedResponses),
}));

export const feedbackRelations = relations(feedback, ({ one }) => ({
  student: one(students, { fields: [feedback.studentId], references: [students.id] }),
}));

export const cachedResponsesRelations = relations(cachedResponses, ({ one }) => ({
  student: one(students, { fields: [cachedResponses.studentId], references: [students.id] }),
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

export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type CachedResponse = typeof cachedResponses.$inferSelect;
