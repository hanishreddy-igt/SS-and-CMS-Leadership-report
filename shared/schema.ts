import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Unified people table - supports both team members and project leads
export const people = pgTable("people", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  roles: text("roles").array().notNull().default(sql`'{}'`),
});

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  customer: text("customer").notNull(),
  leadId: varchar("lead_id").notNull(),
  teamMemberIds: text("team_member_ids").array().notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
  projectType: text("project_type"),
});

export type ProjectType = 'CMS' | 'SS';

export const weeklyReports = pgTable("weekly_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  leadId: varchar("lead_id").notNull(),
  weekStart: text("week_start").notNull(),
  healthStatus: text("health_status"),
  progress: text("progress"),
  challenges: text("challenges"),
  nextWeek: text("next_week"),
  teamMemberFeedback: jsonb("team_member_feedback"),
  status: text("status").notNull().default('draft'),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
});

export const insertPersonSchema = createInsertSchema(people).omit({ id: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true });
export const insertWeeklyReportSchema = createInsertSchema(weeklyReports).omit({ id: true, submittedAt: true });

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
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
export type ReportStatus = 'draft' | 'submitted';
