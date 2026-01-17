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
  hoursPerWeek: text("hours_per_week"), // Hours per week (stored as decimal string, e.g., "6.5")
});

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  customer: text("customer").notNull(),
  customerContactEmail: text("customer_contact_email"), // Customer contact email (optional in DB, validated in form)
  accountOwner: text("account_owner"), // Account owner (optional in DB, validated as caution)
  totalContractualHours: text("total_contractual_hours"), // Total contractual hours (optional)
  leadId: varchar("lead_id").notNull(), // Primary lead (for backward compatibility)
  leadIds: text("lead_ids").array().notNull().default(sql`'{}'`), // All leads including co-leads
  leadAssignments: jsonb("lead_assignments").notNull().default(sql`'[]'`), // Array of { leadId, hours } for lead hours tracking
  teamMembers: jsonb("team_members").notNull().default(sql`'[]'`), // Array of { memberId, role, hours }
  startDate: text("start_date"),
  endDate: text("end_date"),
  projectType: text("project_type"),
  steadyKey: text("steady_key"), // Steady key identifier
  jiraEpic: text("jira_epic"), // Jira Epic URL
  googleDriveLink: text("google_drive_link"), // Google internal folder link
  googleExternalLink: text("google_external_link"), // Google external folder link (if exists)
  workflowyLink: text("workflowy_link"), // Workflowy link
  contractFileLink: text("contract_file_link"), // Contract file link
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

// Report type enum for saved reports
export type SavedReportType = 'account' | 'team';

// Archived weekly report snapshots - stores PDF/CSV for each week
// Now split into 2 reports per week: 'account' (Leadership Summary + Account Reports) and 'team' (Team Feedback Summary + Team Feedback)
export const savedReports = pgTable("saved_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  weekStart: text("week_start").notNull(),
  weekEnd: text("week_end").notNull(),
  reportType: text("report_type").notNull().default('account'), // 'account' or 'team'
  pdfData: text("pdf_data").notNull(), // Base64 encoded PDF (Leadership Summary for account, Team Feedback Summary for team)
  csvData: text("csv_data"), // CSV content (Account Reports for account, Team Feedback for team)
  aiSummary: jsonb("ai_summary"), // AI summary (Leadership for account, Team for team)
  reportCount: text("report_count").notNull(), // Number of reports/feedbacks included
  healthCounts: jsonb("health_counts"), // { onTrack: n, needsAttention: n, critical: n } - only for account type
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

// Feedback entries table - stores individual feedback with submitter tracking
// Feedback is displayed anonymously (submitter hidden from others) but tracked for filtering
export const feedbackEntries = pgTable("feedback_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  aboutPersonId: varchar("about_person_id").notNull(), // Who the feedback is about
  submitterEmail: text("submitter_email").notNull(), // Email of who submitted the feedback
  feedback: text("feedback").notNull(), // The feedback content
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
});

// Tasks table - hierarchical task management with Workflowy-style features
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"), // Extended description/details
  projectId: varchar("project_id"), // Links to a project (optional)
  parentTaskId: varchar("parent_task_id"), // For sub-tasks (null = top-level task)
  assignedTo: text("assigned_to").array().notNull().default(sql`'{}'`), // Array of person IDs
  createdBy: text("created_by").notNull(), // Email of who created the task
  status: text("status").notNull().default('todo'), // todo, in-progress, done, cancelled
  priority: text("priority").default('medium'), // low, medium, high
  tags: text("tags").array().notNull().default(sql`'{}'`), // Inline tags like #status
  notes: jsonb("notes").notNull().default(sql`'[]'`), // Array of { content, author, timestamp }
  dueDate: text("due_date"), // Optional due date
  sortOrder: text("sort_order").default('0'), // For manual ordering within parent
  isExpanded: text("is_expanded").default('true'), // For tree view collapse state
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Task templates table - recurring task templates with EOS update formats
// Sub-template structure for hierarchical deliverables
export type SubTemplateItem = {
  id: string;
  title: string;
  assignedTo?: string[]; // Can override parent's assignees
  priority?: 'low' | 'medium' | 'high';
};

export const taskTemplates = pgTable("task_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Template name (becomes task title)
  description: text("description"), // Informational description
  projectId: varchar("project_id"), // Link to specific project
  assignedTo: text("assigned_to").array().notNull().default(sql`'{}'`), // Array of person IDs
  assignmentMode: text("assignment_mode").default('single'), // 'single' = one task with all assignees, 'per-person' = separate task for each
  subTemplates: jsonb("sub_templates").default(sql`'[]'`), // Array of SubTemplateItem for sub-tasks
  taskItems: text("task_items"), // EOS format or details (becomes task note)
  recurrence: text("recurrence"), // weekly, biweekly, monthly - label only for now
  createdBy: text("created_by").notNull(), // Who created the template
  isActive: text("is_active").default('true'), // Whether template is active
  lastUsedAt: timestamp("last_used_at"), // When template was last used
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCurrentAiSummarySchema = createInsertSchema(currentAiSummary).omit({ id: true, generatedAt: true });
export type CurrentAiSummary = typeof currentAiSummary.$inferSelect;
export type InsertCurrentAiSummary = z.infer<typeof insertCurrentAiSummarySchema>;

export const insertProjectRoleSchema = createInsertSchema(projectRoles).omit({ id: true });
export type ProjectRole = typeof projectRoles.$inferSelect;
export type InsertProjectRole = z.infer<typeof insertProjectRoleSchema>;

export const insertFeedbackEntrySchema = createInsertSchema(feedbackEntries).omit({ id: true, submittedAt: true });
export type FeedbackEntry = typeof feedbackEntries.$inferSelect;
export type InsertFeedbackEntry = z.infer<typeof insertFeedbackEntrySchema>;

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

// Team member assignment with project-specific role and hours
export type TeamMemberAssignment = {
  memberId: string;
  role: string;
  hours?: string; // Hours per week for this specific project assignment
};

// Lead assignment with project-specific hours
export type LeadAssignment = {
  leadId: string;
  hours?: string; // Hours per week for this specific project assignment
};

export type HealthStatus = 'on-track' | 'at-risk' | 'critical';
export type ReportStatus = 'draft' | 'submitted';

// Task schemas and types
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, updatedAt: true });
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

// Task template schemas and types
export const insertTaskTemplateSchema = createInsertSchema(taskTemplates).omit({ id: true, createdAt: true, lastUsedAt: true });
export type TaskTemplate = typeof taskTemplates.$inferSelect;
export type InsertTaskTemplate = z.infer<typeof insertTaskTemplateSchema>;

// Task status enum
export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high';

// Task note structure
export type TaskNote = {
  content: string;
  author: string; // Email of who added the note
  timestamp: string; // ISO date string
};

// Task template structure (for hierarchical task creation)
export type TaskTemplateNode = {
  title: string;
  description?: string;
  assignedTo?: string[];
  status?: TaskStatus;
  priority?: TaskPriority;
  children?: TaskTemplateNode[];
};

// EOS format configuration
export type EOSFormat = {
  includeStatus: boolean;
  includeProgress: boolean;
  includeBlockers: boolean;
  includeNextSteps: boolean;
  customFields?: string[];
};
