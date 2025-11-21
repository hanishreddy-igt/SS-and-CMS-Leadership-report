import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Unified people table - supports both team members and project leads
export const people = pgTable("people", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
});

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  customer: text("customer").notNull(),
  leadId: varchar("lead_id").notNull(),
  teamMemberIds: text("team_member_ids").array().notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
});

export const weeklyReports = pgTable("weekly_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  leadId: varchar("lead_id").notNull(),
  weekStart: text("week_start").notNull(),
  healthStatus: text("health_status").notNull(),
  progress: text("progress").notNull(),
  challenges: text("challenges").notNull(),
  nextWeek: text("next_week").notNull(),
  teamMemberFeedback: jsonb("team_member_feedback"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
});

export const insertPersonSchema = createInsertSchema(people).omit({ id: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true });
export const insertWeeklyReportSchema = createInsertSchema(weeklyReports).omit({ id: true, submittedAt: true });

export type Person = typeof people.$inferSelect;
export type InsertPerson = z.infer<typeof insertPersonSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type WeeklyReport = typeof weeklyReports.$inferSelect;
export type InsertWeeklyReport = z.infer<typeof insertWeeklyReportSchema>;

// Type aliases for backward compatibility
export type TeamMember = Person;
export type ProjectLead = Person;
export type InsertTeamMember = InsertPerson;
export type InsertProjectLead = InsertPerson;

export type TeamMemberFeedback = {
  memberId: string;
  feedback: string;
};

export type HealthStatus = 'on-track' | 'at-risk' | 'critical';
