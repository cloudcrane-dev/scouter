import { sql } from "drizzle-orm";
import { pgTable, serial, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/chat";

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  pictureUrl: text("picture_url"),
  searchCount: integer("search_count").default(0).notNull(),
  upvoteCount: integer("upvote_count").default(0).notNull(),
});

export const resumeRatings = pgTable("resume_ratings", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  reviewerHandle: text("reviewer_handle").notNull(),
  fileName: text("file_name").notNull(),
  resumeText: text("resume_text").notNull(),
  rating: integer("rating").notNull(),
  summary: text("summary").notNull(),
  improvementFactors: text("improvement_factors").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const studentResumes = pgTable("student_resumes", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  contentBase64: text("content_base64").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const profileUpvotes = pgTable(
  "profile_upvotes",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    voterHandle: text("voter_handle").notNull(),
    createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    uniqueStudentVoter: uniqueIndex("profile_upvotes_student_voter_idx").on(table.studentId, table.voterHandle),
  })
);

export const cachedResponses = pgTable("cached_responses", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  response: text("response").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const studentsRelations = relations(students, ({ many }) => ({
  resumeRatings: many(resumeRatings),
  studentResumes: many(studentResumes),
  profileUpvotes: many(profileUpvotes),
  cachedResponses: many(cachedResponses),
}));

export const resumeRatingsRelations = relations(resumeRatings, ({ one }) => ({
  student: one(students, { fields: [resumeRatings.studentId], references: [students.id] }),
}));

export const profileUpvotesRelations = relations(profileUpvotes, ({ one }) => ({
  student: one(students, { fields: [profileUpvotes.studentId], references: [students.id] }),
}));

export const studentResumesRelations = relations(studentResumes, ({ one }) => ({
  student: one(students, { fields: [studentResumes.studentId], references: [students.id] }),
}));

export const cachedResponsesRelations = relations(cachedResponses, ({ one }) => ({
  student: one(students, { fields: [cachedResponses.studentId], references: [students.id] }),
}));

export const insertStudentSchema = createInsertSchema(students).omit({
  id: true,
  searchCount: true,
  upvoteCount: true,
});

export const insertResumeRatingSchema = createInsertSchema(resumeRatings).omit({
  id: true,
  createdAt: true,
});

export const insertProfileUpvoteSchema = createInsertSchema(profileUpvotes).omit({
  id: true,
  createdAt: true,
});

export const insertStudentResumeSchema = createInsertSchema(studentResumes).omit({
  id: true,
  createdAt: true,
});

export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type ResumeRating = typeof resumeRatings.$inferSelect;
export type InsertResumeRating = z.infer<typeof insertResumeRatingSchema>;
export type ProfileUpvote = typeof profileUpvotes.$inferSelect;
export type InsertProfileUpvote = z.infer<typeof insertProfileUpvoteSchema>;
export type StudentResume = typeof studentResumes.$inferSelect;
export type InsertStudentResume = z.infer<typeof insertStudentResumeSchema>;
export type CachedResponse = typeof cachedResponses.$inferSelect;
