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

// User roles for access control
export type UserRole = 'admin' | 'manager' | 'lead' | 'member';

// User storage table for authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  displayName: varchar("display_name"), // Editable display name
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default('member'), // admin, manager, lead, member
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Role upgrade requests
export const roleRequests = pgTable("role_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  userEmail: varchar("user_email").notNull(),
  currentRole: varchar("current_role").notNull(),
  requestedRole: varchar("requested_role").notNull(),
  reason: text("reason"),
  status: varchar("status").notNull().default('pending'), // pending, approved, denied
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by"),
});

// Unified people table - supports both team members and project leads
export const people = pgTable("people", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  roles: text("roles").array().notNull().default(sql`'{}'`),
  feedback: text("feedback"), // General feedback/notes about this person
});

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  customer: text("customer").notNull(),
  customerContactEmail: text("customer_contact_email"), // Customer contact email (optional in DB, validated in form)
  totalContractualHours: text("total_contractual_hours"), // Total contractual hours (optional)
  leadId: varchar("lead_id").notNull(), // Primary lead (for backward compatibility)
  leadIds: text("lead_ids").array().notNull().default(sql`'{}'`), // All leads including co-leads
  teamMembers: jsonb("team_members").notNull().default(sql`'[]'`), // Array of { memberId, role }
  startDate: text("start_date"),
  endDate: text("end_date"),
  projectType: text("project_type"),
});

export type ProjectType = 'CMS' | 'SS';

export const weeklyReports = pgTable("weekly_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  leadId: varchar("lead_id").notNull(), // Primary lead for the project
  weekStart: text("week_start").notNull(),
  healthStatus: text("health_status"),
  progress: text("progress"),
  challenges: text("challenges"),
  nextWeek: text("next_week"),
  teamMemberFeedback: jsonb("team_member_feedback"),
  status: text("status").notNull().default('draft'),
  submittedByLeadId: varchar("submitted_by_lead_id"), // Who actually submitted (for co-lead tracking)
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
});

// Archived weekly report snapshots - stores PDF/CSV for each week
export const savedReports = pgTable("saved_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  weekStart: text("week_start").notNull().unique(), // Week identifier - only one per week
  weekEnd: text("week_end").notNull(),
  pdfData: text("pdf_data").notNull(), // Base64 encoded PDF
  csvData: text("csv_data"), // CSV content
  aiSummary: jsonb("ai_summary"), // AI summary if generated
  teamFeedback: jsonb("team_feedback"), // Archived team member/lead feedback
  reportCount: text("report_count").notNull(), // Number of reports included
  healthCounts: jsonb("health_counts"), // { onTrack: n, needsAttention: n, critical: n }
  savedAt: timestamp("saved_at").notNull().defaultNow(),
});

// Current week's AI summary - persists until reset
export const currentAiSummary = pgTable("current_ai_summary", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  weekStart: text("week_start").notNull().unique(), // Current week identifier
  summary: jsonb("summary").notNull(), // The AI-generated summary
  reportsAnalyzed: text("reports_analyzed").notNull(), // Number of reports analyzed
  generatedAt: timestamp("generated_at").notNull().defaultNow(), // When it was generated (UTC)
});

// Project roles table - stores available roles for team member assignments
export const projectRoles = pgTable("project_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(), // Role name
  isDefault: text("is_default").default('false'), // Whether it's a system default role
});

export const insertCurrentAiSummarySchema = createInsertSchema(currentAiSummary).omit({ id: true, generatedAt: true });
export type CurrentAiSummary = typeof currentAiSummary.$inferSelect;
export type InsertCurrentAiSummary = z.infer<typeof insertCurrentAiSummarySchema>;

export const insertProjectRoleSchema = createInsertSchema(projectRoles).omit({ id: true });
export type ProjectRole = typeof projectRoles.$inferSelect;
export type InsertProjectRole = z.infer<typeof insertProjectRoleSchema>;

export const insertRoleRequestSchema = createInsertSchema(roleRequests).omit({ id: true, createdAt: true, resolvedAt: true, resolvedBy: true });
export type RoleRequest = typeof roleRequests.$inferSelect;
export type InsertRoleRequest = z.infer<typeof insertRoleRequestSchema>;

export const insertPersonSchema = createInsertSchema(people).omit({ id: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true });
export const insertWeeklyReportSchema = createInsertSchema(weeklyReports).omit({ id: true, submittedAt: true });
export const insertSavedReportSchema = createInsertSchema(savedReports).omit({ id: true, savedAt: true });

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Person = typeof people.$inferSelect;
export type InsertPerson = z.infer<typeof insertPersonSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type WeeklyReport = typeof weeklyReports.$inferSelect;
export type InsertWeeklyReport = z.infer<typeof insertWeeklyReportSchema>;
export type SavedReport = typeof savedReports.$inferSelect;
export type InsertSavedReport = z.infer<typeof insertSavedReportSchema>;

// Type aliases for backward compatibility
export type TeamMember = Person;
export type ProjectLead = Person;
export type InsertTeamMember = InsertPerson;
export type InsertProjectLead = InsertPerson;

export type TeamMemberFeedback = {
  memberId: string;
  feedback: string;
};

// Team member assignment with project-specific role
export type TeamMemberAssignment = {
  memberId: string;
  role: string;
};

export type HealthStatus = 'on-track' | 'at-risk' | 'critical';
export type ReportStatus = 'draft' | 'submitted';
