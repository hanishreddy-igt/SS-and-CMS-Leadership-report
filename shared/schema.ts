import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const teamMembers = pgTable("team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
});

export const projectLeads = pgTable("project_leads", {
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
  progress: text("progress").notNull(),
  challenges: text("challenges").notNull(),
  nextWeek: text("next_week").notNull(),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({ id: true });
export const insertProjectLeadSchema = createInsertSchema(projectLeads).omit({ id: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true });
export const insertWeeklyReportSchema = createInsertSchema(weeklyReports).omit({ id: true, submittedAt: true });

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type ProjectLead = typeof projectLeads.$inferSelect;
export type InsertProjectLead = z.infer<typeof insertProjectLeadSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type WeeklyReport = typeof weeklyReports.$inferSelect;
export type InsertWeeklyReport = z.infer<typeof insertWeeklyReportSchema>;
