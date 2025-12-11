import { randomUUID } from "crypto";
import type {
  TeamMember,
  InsertTeamMember,
  ProjectLead,
  InsertProjectLead,
  Project,
  InsertProject,
  WeeklyReport,
  InsertWeeklyReport,
  Person,
  InsertPerson,
  User,
  UpsertUser,
  SavedReport,
  InsertSavedReport,
  CurrentAiSummary,
  InsertCurrentAiSummary,
  ProjectRole,
  InsertProjectRole,
} from "@shared/schema";
import { people, projects, weeklyReports, users, savedReports, currentAiSummary, projectRoles } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // User operations (required for authentication)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Team Members (using unified people)
  getTeamMembers(): Promise<TeamMember[]>;
  getTeamMember(id: string): Promise<TeamMember | undefined>;
  createTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  updateTeamMember(id: string, member: Partial<InsertTeamMember>): Promise<TeamMember | undefined>;
  deleteTeamMember(id: string): Promise<boolean>;

  // Project Leads (using unified people)
  getProjectLeads(): Promise<ProjectLead[]>;
  getProjectLead(id: string): Promise<ProjectLead | undefined>;
  createProjectLead(lead: InsertProjectLead): Promise<ProjectLead>;
  updateProjectLead(id: string, lead: Partial<InsertProjectLead>): Promise<ProjectLead | undefined>;
  deleteProjectLead(id: string): Promise<boolean>;

  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;

  // Weekly Reports
  getWeeklyReports(): Promise<WeeklyReport[]>;
  getWeeklyReport(id: string): Promise<WeeklyReport | undefined>;
  createWeeklyReport(report: InsertWeeklyReport): Promise<WeeklyReport>;
  updateWeeklyReport(id: string, report: Partial<InsertWeeklyReport>): Promise<WeeklyReport | undefined>;
  deleteWeeklyReport(id: string): Promise<boolean>;

  // Saved Reports (archived weekly snapshots)
  getSavedReports(): Promise<SavedReport[]>;
  getSavedReport(id: string): Promise<SavedReport | undefined>;
  getSavedReportByWeek(weekStart: string): Promise<SavedReport | undefined>;
  upsertSavedReport(report: InsertSavedReport): Promise<SavedReport>;
  deleteSavedReport(id: string): Promise<boolean>;

  // Current AI Summary (persisted current week's summary)
  getCurrentAiSummary(weekStart: string): Promise<CurrentAiSummary | undefined>;
  upsertCurrentAiSummary(summary: InsertCurrentAiSummary): Promise<CurrentAiSummary>;
  deleteCurrentAiSummary(weekStart: string): Promise<boolean>;

  // Project Roles
  getProjectRoles(): Promise<ProjectRole[]>;
  getProjectRole(id: string): Promise<ProjectRole | undefined>;
  createProjectRole(role: InsertProjectRole): Promise<ProjectRole>;
  deleteProjectRole(id: string): Promise<boolean>;
  seedDefaultRoles(): Promise<void>;

  // Person feedback operations
  getAllPeople(): Promise<Person[]>;
  getPersonById(id: string): Promise<Person | undefined>;
  updatePersonFeedback(id: string, feedback: string): Promise<Person | undefined>;
  clearAllFeedback(): Promise<void>;
}

export class MemStorage implements IStorage {
  // Unified people storage - same person can be both team member and project lead
  private users: Map<string, User>;
  private people: Map<string, Person>;
  private projects: Map<string, Project>;
  private weeklyReports: Map<string, WeeklyReport>;
  private savedReports: Map<string, SavedReport>;
  private currentAiSummaries: Map<string, CurrentAiSummary>;

  constructor() {
    this.users = new Map();
    this.people = new Map();
    this.projects = new Map();
    this.weeklyReports = new Map();
    this.savedReports = new Map();
    this.currentAiSummaries = new Map();
  }

  // User operations (required for authentication)
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existing = this.users.get(userData.id!);
    const user: User = {
      id: userData.id || randomUUID(),
      email: userData.email || null,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      profileImageUrl: userData.profileImageUrl || null,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  // Team Members (uses unified people storage)
  async getTeamMembers(): Promise<TeamMember[]> {
    return Array.from(this.people.values()).filter(person => person.roles.includes('team-member'));
  }

  async getTeamMember(id: string): Promise<TeamMember | undefined> {
    return this.people.get(id);
  }

  async createTeamMember(insertMember: InsertTeamMember): Promise<TeamMember> {
    const id = randomUUID();
    const member: TeamMember = { ...insertMember, id, roles: ['team-member'], email: insertMember.email ?? null };
    this.people.set(id, member);
    return member;
  }

  async updateTeamMember(id: string, updates: Partial<InsertTeamMember>): Promise<TeamMember | undefined> {
    const member = this.people.get(id);
    if (!member) return undefined;
    const updated = { ...member, ...updates };
    this.people.set(id, updated);
    return updated;
  }

  async deleteTeamMember(id: string): Promise<boolean> {
    return this.people.delete(id);
  }

  // Project Leads (uses unified people storage)
  async getProjectLeads(): Promise<ProjectLead[]> {
    return Array.from(this.people.values()).filter(person => person.roles.includes('project-lead'));
  }

  async getProjectLead(id: string): Promise<ProjectLead | undefined> {
    return this.people.get(id);
  }

  async createProjectLead(insertLead: InsertProjectLead): Promise<ProjectLead> {
    const id = randomUUID();
    const lead: ProjectLead = { ...insertLead, id, roles: ['project-lead'], email: insertLead.email ?? null };
    this.people.set(id, lead);
    return lead;
  }

  async updateProjectLead(id: string, updates: Partial<InsertProjectLead>): Promise<ProjectLead | undefined> {
    const lead = this.people.get(id);
    if (!lead) return undefined;
    const updated = { ...lead, ...updates };
    this.people.set(id, updated);
    return updated;
  }

  async deleteProjectLead(id: string): Promise<boolean> {
    return this.people.delete(id);
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const project: Project = { 
      ...insertProject, 
      id,
      leadIds: insertProject.leadIds ?? [],
      teamMembers: insertProject.teamMembers ?? [],
      startDate: insertProject.startDate ?? null,
      endDate: insertProject.endDate ?? null,
      projectType: insertProject.projectType ?? null,
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;
    const updated = { ...project, ...updates };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.projects.delete(id);
  }

  // Weekly Reports
  async getWeeklyReports(): Promise<WeeklyReport[]> {
    return Array.from(this.weeklyReports.values());
  }

  async getWeeklyReport(id: string): Promise<WeeklyReport | undefined> {
    return this.weeklyReports.get(id);
  }

  async createWeeklyReport(insertReport: InsertWeeklyReport): Promise<WeeklyReport> {
    const id = randomUUID();
    const report: WeeklyReport = { 
      ...insertReport,
      healthStatus: insertReport.healthStatus ?? null,
      progress: insertReport.progress ?? null,
      challenges: insertReport.challenges ?? null,
      nextWeek: insertReport.nextWeek ?? null,
      teamMemberFeedback: insertReport.teamMemberFeedback ?? null,
      status: insertReport.status ?? 'draft',
      submittedByLeadId: insertReport.submittedByLeadId ?? null,
      id,
      submittedAt: new Date()
    };
    this.weeklyReports.set(id, report);
    return report;
  }

  async updateWeeklyReport(id: string, updates: Partial<InsertWeeklyReport>): Promise<WeeklyReport | undefined> {
    const report = this.weeklyReports.get(id);
    if (!report) return undefined;
    const updated = { ...report, ...updates };
    this.weeklyReports.set(id, updated);
    return updated;
  }

  async deleteWeeklyReport(id: string): Promise<boolean> {
    return this.weeklyReports.delete(id);
  }

  // Saved Reports (archived weekly snapshots)
  async getSavedReports(): Promise<SavedReport[]> {
    return Array.from(this.savedReports.values());
  }

  async getSavedReport(id: string): Promise<SavedReport | undefined> {
    return this.savedReports.get(id);
  }

  async getSavedReportByWeek(weekStart: string): Promise<SavedReport | undefined> {
    return Array.from(this.savedReports.values()).find(r => r.weekStart === weekStart);
  }

  async upsertSavedReport(insertReport: InsertSavedReport): Promise<SavedReport> {
    const existing = Array.from(this.savedReports.values()).find(r => r.weekStart === insertReport.weekStart);
    if (existing) {
      const updated: SavedReport = { 
        ...existing, 
        ...insertReport, 
        csvData: insertReport.csvData ?? null,
        aiSummary: insertReport.aiSummary ?? null,
        teamFeedback: insertReport.teamFeedback ?? null,
        healthCounts: insertReport.healthCounts ?? null,
        savedAt: new Date() 
      };
      this.savedReports.set(existing.id, updated);
      return updated;
    }
    const id = randomUUID();
    const report: SavedReport = { 
      ...insertReport, 
      id, 
      csvData: insertReport.csvData ?? null,
      aiSummary: insertReport.aiSummary ?? null,
      teamFeedback: insertReport.teamFeedback ?? null,
      healthCounts: insertReport.healthCounts ?? null,
      savedAt: new Date() 
    };
    this.savedReports.set(id, report);
    return report;
  }

  async deleteSavedReport(id: string): Promise<boolean> {
    return this.savedReports.delete(id);
  }

  // Current AI Summary
  async getCurrentAiSummary(weekStart: string): Promise<CurrentAiSummary | undefined> {
    return this.currentAiSummaries.get(weekStart);
  }

  async upsertCurrentAiSummary(insertSummary: InsertCurrentAiSummary): Promise<CurrentAiSummary> {
    const existing = this.currentAiSummaries.get(insertSummary.weekStart);
    if (existing) {
      const updated: CurrentAiSummary = { 
        ...existing, 
        ...insertSummary, 
        generatedAt: new Date() 
      };
      this.currentAiSummaries.set(insertSummary.weekStart, updated);
      return updated;
    }
    const id = randomUUID();
    const summary: CurrentAiSummary = { 
      ...insertSummary, 
      id, 
      generatedAt: new Date() 
    };
    this.currentAiSummaries.set(insertSummary.weekStart, summary);
    return summary;
  }

  async deleteCurrentAiSummary(weekStart: string): Promise<boolean> {
    return this.currentAiSummaries.delete(weekStart);
  }

  // Project Roles - MemStorage implementation
  private projectRoles: Map<string, ProjectRole> = new Map();

  async getProjectRoles(): Promise<ProjectRole[]> {
    return Array.from(this.projectRoles.values());
  }

  async getProjectRole(id: string): Promise<ProjectRole | undefined> {
    return this.projectRoles.get(id);
  }

  async createProjectRole(role: InsertProjectRole): Promise<ProjectRole> {
    const id = randomUUID();
    const newRole: ProjectRole = { id, name: role.name, isDefault: role.isDefault ?? 'false' };
    this.projectRoles.set(id, newRole);
    return newRole;
  }

  async deleteProjectRole(id: string): Promise<boolean> {
    return this.projectRoles.delete(id);
  }

  async seedDefaultRoles(): Promise<void> {
    const defaultRoles = [
      'Digital Engagement Specialist',
      'Digital Engagement Coordinator',
      'Social Listening Specialist',
      'Social Listening Coordinator',
      'Community Moderator',
      'Community Advisor',
      'Community Admin',
      'Community Moderator + Reporting',
      'Community Reporting',
    ];
    for (const roleName of defaultRoles) {
      const exists = Array.from(this.projectRoles.values()).find(r => r.name === roleName);
      if (!exists) {
        await this.createProjectRole({ name: roleName, isDefault: 'true' });
      }
    }
  }

  // Person feedback operations for MemStorage
  async getAllPeople(): Promise<Person[]> {
    return Array.from(this.people.values());
  }

  async getPersonById(id: string): Promise<Person | undefined> {
    return this.people.get(id);
  }

  async updatePersonFeedback(id: string, feedback: string): Promise<Person | undefined> {
    const person = this.people.get(id);
    if (!person) return undefined;
    const updated = { ...person, feedback };
    this.people.set(id, updated);
    return updated;
  }

  async clearAllFeedback(): Promise<void> {
    const entries = Array.from(this.people.entries());
    for (const [id, person] of entries) {
      if (person.feedback) {
        this.people.set(id, { ...person, feedback: null });
      }
    }
  }
}

export class DatabaseStorage implements IStorage {
  // User operations (required for authentication)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // First check if user exists by email (since email has unique constraint)
    if (userData.email) {
      const [existingByEmail] = await db.select().from(users).where(eq(users.email, userData.email));
      if (existingByEmail && existingByEmail.id !== userData.id) {
        // User exists with this email but different id - update existing user
        const [updated] = await db
          .update(users)
          .set({ ...userData, id: existingByEmail.id, updatedAt: new Date() })
          .where(eq(users.id, existingByEmail.id))
          .returning();
        return updated;
      }
    }
    
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getTeamMembers(): Promise<TeamMember[]> {
    const allPeople = await db.select().from(people);
    return allPeople.filter(person => person.roles.includes('team-member'));
  }

  async getTeamMember(id: string): Promise<TeamMember | undefined> {
    const [person] = await db.select().from(people).where(eq(people.id, id));
    return person || undefined;
  }

  async createTeamMember(insertMember: InsertTeamMember): Promise<TeamMember> {
    const [member] = await db.insert(people).values({
      ...insertMember,
      roles: ['team-member']
    }).returning();
    return member;
  }

  async updateTeamMember(id: string, updates: Partial<InsertTeamMember>): Promise<TeamMember | undefined> {
    const [updated] = await db.update(people).set(updates).where(eq(people.id, id)).returning();
    return updated || undefined;
  }

  async deleteTeamMember(id: string): Promise<boolean> {
    const result = await db.delete(people).where(eq(people.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getProjectLeads(): Promise<ProjectLead[]> {
    const allPeople = await db.select().from(people);
    return allPeople.filter(person => person.roles.includes('project-lead'));
  }

  async getProjectLead(id: string): Promise<ProjectLead | undefined> {
    const [person] = await db.select().from(people).where(eq(people.id, id));
    return person || undefined;
  }

  async createProjectLead(insertLead: InsertProjectLead): Promise<ProjectLead> {
    const [lead] = await db.insert(people).values({
      ...insertLead,
      roles: ['project-lead']
    }).returning();
    return lead;
  }

  async updateProjectLead(id: string, updates: Partial<InsertProjectLead>): Promise<ProjectLead | undefined> {
    const [updated] = await db.update(people).set(updates).where(eq(people.id, id)).returning();
    return updated || undefined;
  }

  async deleteProjectLead(id: string): Promise<boolean> {
    const result = await db.delete(people).where(eq(people.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Generic person methods for feedback
  async getPersonById(id: string): Promise<Person | undefined> {
    const [person] = await db.select().from(people).where(eq(people.id, id));
    return person || undefined;
  }

  async updatePersonFeedback(id: string, feedback: string): Promise<Person | undefined> {
    const [updated] = await db.update(people).set({ feedback }).where(eq(people.id, id)).returning();
    return updated || undefined;
  }

  async getAllPeople(): Promise<Person[]> {
    return await db.select().from(people);
  }

  async clearAllFeedback(): Promise<void> {
    await db.update(people).set({ feedback: null });
  }

  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects);
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values(insertProject).returning();
    return project;
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const [updated] = await db.update(projects).set(updates).where(eq(projects.id, id)).returning();
    return updated || undefined;
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getWeeklyReports(): Promise<WeeklyReport[]> {
    return await db.select().from(weeklyReports);
  }

  async getWeeklyReport(id: string): Promise<WeeklyReport | undefined> {
    const [report] = await db.select().from(weeklyReports).where(eq(weeklyReports.id, id));
    return report || undefined;
  }

  async createWeeklyReport(insertReport: InsertWeeklyReport): Promise<WeeklyReport> {
    const [report] = await db.insert(weeklyReports).values(insertReport).returning();
    return report;
  }

  async updateWeeklyReport(id: string, updates: Partial<InsertWeeklyReport>): Promise<WeeklyReport | undefined> {
    const [updated] = await db.update(weeklyReports).set(updates).where(eq(weeklyReports.id, id)).returning();
    return updated || undefined;
  }

  async deleteWeeklyReport(id: string): Promise<boolean> {
    const result = await db.delete(weeklyReports).where(eq(weeklyReports.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Saved Reports (archived weekly snapshots)
  async getSavedReports(): Promise<SavedReport[]> {
    return await db.select().from(savedReports);
  }

  async getSavedReport(id: string): Promise<SavedReport | undefined> {
    const [report] = await db.select().from(savedReports).where(eq(savedReports.id, id));
    return report || undefined;
  }

  async getSavedReportByWeek(weekStart: string): Promise<SavedReport | undefined> {
    const [report] = await db.select().from(savedReports).where(eq(savedReports.weekStart, weekStart));
    return report || undefined;
  }

  async upsertSavedReport(insertReport: InsertSavedReport): Promise<SavedReport> {
    const [report] = await db
      .insert(savedReports)
      .values(insertReport)
      .onConflictDoUpdate({
        target: savedReports.weekStart,
        set: {
          ...insertReport,
          savedAt: new Date(),
        },
      })
      .returning();
    return report;
  }

  async deleteSavedReport(id: string): Promise<boolean> {
    const result = await db.delete(savedReports).where(eq(savedReports.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Current AI Summary
  async getCurrentAiSummary(weekStart: string): Promise<CurrentAiSummary | undefined> {
    const [summary] = await db.select().from(currentAiSummary).where(eq(currentAiSummary.weekStart, weekStart));
    return summary || undefined;
  }

  async upsertCurrentAiSummary(insertSummary: InsertCurrentAiSummary): Promise<CurrentAiSummary> {
    const [summary] = await db
      .insert(currentAiSummary)
      .values(insertSummary)
      .onConflictDoUpdate({
        target: currentAiSummary.weekStart,
        set: {
          ...insertSummary,
          generatedAt: new Date(),
        },
      })
      .returning();
    return summary;
  }

  async deleteCurrentAiSummary(weekStart: string): Promise<boolean> {
    const result = await db.delete(currentAiSummary).where(eq(currentAiSummary.weekStart, weekStart));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Project Roles
  async getProjectRoles(): Promise<ProjectRole[]> {
    return await db.select().from(projectRoles);
  }

  async getProjectRole(id: string): Promise<ProjectRole | undefined> {
    const [role] = await db.select().from(projectRoles).where(eq(projectRoles.id, id));
    return role || undefined;
  }

  async createProjectRole(role: InsertProjectRole): Promise<ProjectRole> {
    const [newRole] = await db.insert(projectRoles).values(role).returning();
    return newRole;
  }

  async deleteProjectRole(id: string): Promise<boolean> {
    const result = await db.delete(projectRoles).where(eq(projectRoles.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async seedDefaultRoles(): Promise<void> {
    const defaultRoles = [
      'Digital Engagement Specialist',
      'Digital Engagement Coordinator',
      'Social Listening Specialist',
      'Social Listening Coordinator',
      'Community Moderator',
      'Community Advisor',
      'Community Admin',
      'Community Moderator + Reporting',
      'Community Reporting',
    ];
    
    for (const roleName of defaultRoles) {
      try {
        await db.insert(projectRoles).values({ name: roleName, isDefault: 'true' }).onConflictDoNothing();
      } catch (e) {
        // Ignore duplicate key errors
      }
    }
  }
}

export const storage = new DatabaseStorage();
