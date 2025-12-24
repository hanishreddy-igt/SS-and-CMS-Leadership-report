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
  SavedReportType,
  CurrentAiSummary,
  InsertCurrentAiSummary,
  ProjectRole,
  InsertProjectRole,
  RoleRequest,
  InsertRoleRequest,
  UserRole,
  FeedbackEntry,
  InsertFeedbackEntry,
} from "@shared/schema";
import { people, projects, weeklyReports, users, savedReports, currentAiSummary, projectRoles, roleRequests, feedbackEntries } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

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

  // Saved Reports (archived weekly snapshots - 2 per week: account + team)
  getSavedReports(): Promise<SavedReport[]>;
  getSavedReport(id: string): Promise<SavedReport | undefined>;
  getSavedReportByWeek(weekStart: string, reportType: SavedReportType): Promise<SavedReport | undefined>;
  getSavedReportsByWeek(weekStart: string): Promise<SavedReport[]>;
  upsertSavedReport(report: InsertSavedReport): Promise<SavedReport>;
  updateSavedReportAiSummary(id: string, aiSummary: unknown): Promise<SavedReport | undefined>;
  deleteSavedReport(id: string): Promise<boolean>;
  deleteSavedReportsByWeek(weekStart: string): Promise<boolean>;

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

  // Feedback entries (with submitter tracking)
  getAllFeedbackEntries(): Promise<FeedbackEntry[]>;
  getFeedbackEntriesBySubmitter(email: string): Promise<FeedbackEntry[]>;
  getFeedbackEntriesAboutPerson(personId: string): Promise<FeedbackEntry[]>;
  createFeedbackEntry(entry: InsertFeedbackEntry): Promise<FeedbackEntry>;
  clearAllFeedbackEntries(): Promise<void>;

  // User role management
  getAllUsers(): Promise<User[]>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(userData: { email: string; firstName?: string; lastName?: string; role: UserRole }): Promise<User>;
  updateUserRole(userId: string, role: UserRole): Promise<User | undefined>;
  updateUserProfile(userId: string, updates: { displayName?: string }): Promise<User | undefined>;
  deleteUser(userId: string): Promise<boolean>;

  // Role requests
  getRoleRequests(): Promise<RoleRequest[]>;
  getPendingRoleRequests(): Promise<RoleRequest[]>;
  createRoleRequest(request: InsertRoleRequest): Promise<RoleRequest>;
  updateRoleRequest(id: string, status: 'approved' | 'denied', resolvedBy: string): Promise<RoleRequest | undefined>;
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

  private roleRequests: Map<string, RoleRequest> = new Map();

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
      displayName: userData.displayName || existing?.displayName || null,
      profileImageUrl: userData.profileImageUrl || null,
      role: existing?.role || (userData.email === 'hanish.reddy@ignitetech.com' ? 'admin' : 'member'),
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  async createUser(userData: { email: string; firstName?: string; lastName?: string; role: UserRole }): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      email: userData.email,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      displayName: null,
      profileImageUrl: null,
      role: userData.role,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserRole(userId: string, role: UserRole): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    const updated = { ...user, role, updatedAt: new Date() };
    this.users.set(userId, updated);
    return updated;
  }

  async updateUserProfile(userId: string, updates: { displayName?: string }): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    const updated = { ...user, ...updates, updatedAt: new Date() };
    this.users.set(userId, updated);
    return updated;
  }

  async deleteUser(userId: string): Promise<boolean> {
    return this.users.delete(userId);
  }

  async getRoleRequests(): Promise<RoleRequest[]> {
    return Array.from(this.roleRequests.values());
  }

  async getPendingRoleRequests(): Promise<RoleRequest[]> {
    return Array.from(this.roleRequests.values()).filter(r => r.status === 'pending');
  }

  async createRoleRequest(request: InsertRoleRequest): Promise<RoleRequest> {
    const id = randomUUID();
    const roleRequest: RoleRequest = {
      ...request,
      id,
      reason: request.reason || null,
      status: 'pending',
      createdAt: new Date(),
      resolvedAt: null,
      resolvedBy: null,
    };
    this.roleRequests.set(id, roleRequest);
    return roleRequest;
  }

  async updateRoleRequest(id: string, status: 'approved' | 'denied', resolvedBy: string): Promise<RoleRequest | undefined> {
    const request = this.roleRequests.get(id);
    if (!request) return undefined;
    const updated: RoleRequest = { ...request, status, resolvedBy, resolvedAt: new Date() };
    this.roleRequests.set(id, updated);
    return updated;
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
    const member: TeamMember = { 
      name: insertMember.name,
      id, 
      roles: ['team-member'], 
      email: insertMember.email ?? null,
      feedback: insertMember.feedback ?? null,
    };
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
    const lead: ProjectLead = { 
      name: insertLead.name,
      id, 
      roles: ['project-lead'], 
      email: insertLead.email ?? null,
      feedback: insertLead.feedback ?? null,
    };
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
      name: insertProject.name,
      customer: insertProject.customer,
      customerContactEmail: insertProject.customerContactEmail ?? null,
      totalContractualHours: insertProject.totalContractualHours ?? null,
      leadId: insertProject.leadId,
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

  // Saved Reports (archived weekly snapshots - 2 per week: account + team)
  async getSavedReports(): Promise<SavedReport[]> {
    return Array.from(this.savedReports.values());
  }

  async getSavedReport(id: string): Promise<SavedReport | undefined> {
    return this.savedReports.get(id);
  }

  async getSavedReportByWeek(weekStart: string, reportType: SavedReportType): Promise<SavedReport | undefined> {
    return Array.from(this.savedReports.values()).find(r => r.weekStart === weekStart && r.reportType === reportType);
  }

  async getSavedReportsByWeek(weekStart: string): Promise<SavedReport[]> {
    return Array.from(this.savedReports.values()).filter(r => r.weekStart === weekStart);
  }

  async upsertSavedReport(insertReport: InsertSavedReport): Promise<SavedReport> {
    const reportType = insertReport.reportType || 'account';
    const existing = Array.from(this.savedReports.values()).find(
      r => r.weekStart === insertReport.weekStart && r.reportType === reportType
    );
    if (existing) {
      const updated: SavedReport = { 
        ...existing, 
        ...insertReport, 
        reportType,
        csvData: insertReport.csvData ?? null,
        aiSummary: insertReport.aiSummary ?? null,
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
      reportType,
      csvData: insertReport.csvData ?? null,
      aiSummary: insertReport.aiSummary ?? null,
      healthCounts: insertReport.healthCounts ?? null,
      savedAt: new Date() 
    };
    this.savedReports.set(id, report);
    return report;
  }

  async updateSavedReportAiSummary(id: string, aiSummary: unknown): Promise<SavedReport | undefined> {
    const existing = this.savedReports.get(id);
    if (!existing) return undefined;
    const updated: SavedReport = { ...existing, aiSummary };
    this.savedReports.set(id, updated);
    return updated;
  }

  async deleteSavedReport(id: string): Promise<boolean> {
    return this.savedReports.delete(id);
  }

  async deleteSavedReportsByWeek(weekStart: string): Promise<boolean> {
    const reportsToDelete = Array.from(this.savedReports.values()).filter(r => r.weekStart === weekStart);
    reportsToDelete.forEach(r => this.savedReports.delete(r.id));
    return reportsToDelete.length > 0;
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

  // Feedback entries for MemStorage
  private feedbackEntriesStore: Map<string, FeedbackEntry> = new Map();

  async getAllFeedbackEntries(): Promise<FeedbackEntry[]> {
    return Array.from(this.feedbackEntriesStore.values());
  }

  async getFeedbackEntriesBySubmitter(email: string): Promise<FeedbackEntry[]> {
    return Array.from(this.feedbackEntriesStore.values()).filter(e => e.submitterEmail === email);
  }

  async getFeedbackEntriesAboutPerson(personId: string): Promise<FeedbackEntry[]> {
    return Array.from(this.feedbackEntriesStore.values()).filter(e => e.aboutPersonId === personId);
  }

  async createFeedbackEntry(entry: InsertFeedbackEntry): Promise<FeedbackEntry> {
    const id = randomUUID();
    const newEntry: FeedbackEntry = {
      id,
      aboutPersonId: entry.aboutPersonId,
      submitterEmail: entry.submitterEmail,
      feedback: entry.feedback,
      submittedAt: new Date(),
    };
    this.feedbackEntriesStore.set(id, newEntry);
    return newEntry;
  }

  async clearAllFeedbackEntries(): Promise<void> {
    this.feedbackEntriesStore.clear();
  }
}

export class DatabaseStorage implements IStorage {
  // User operations (required for authentication)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Determine default role - admin for specific email, member for everyone else
    const defaultRole = userData.email === 'hanish.reddy@ignitetech.com' ? 'admin' : 'member';
    
    // First check if user exists by email (since email has unique constraint)
    if (userData.email) {
      const [existingByEmail] = await db.select().from(users).where(eq(users.email, userData.email));
      if (existingByEmail && existingByEmail.id !== userData.id) {
        // User exists with this email but different id - update existing user, preserve role
        const [updated] = await db
          .update(users)
          .set({ 
            ...userData, 
            id: existingByEmail.id, 
            role: existingByEmail.role, // Preserve existing role
            displayName: existingByEmail.displayName, // Preserve display name
            updatedAt: new Date() 
          })
          .where(eq(users.id, existingByEmail.id))
          .returning();
        return updated;
      }
    }
    
    // Check if user already exists by id to preserve role
    const [existingById] = await db.select().from(users).where(eq(users.id, userData.id!));
    
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        role: existingById?.role || defaultRole, // Preserve existing role or use default
        displayName: existingById?.displayName || null, // Preserve display name
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          role: existingById?.role || defaultRole, // Preserve existing role
          displayName: existingById?.displayName, // Preserve display name  
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

  // Feedback entries (with submitter tracking) - DatabaseStorage
  async getAllFeedbackEntries(): Promise<FeedbackEntry[]> {
    return await db.select().from(feedbackEntries);
  }

  async getFeedbackEntriesBySubmitter(email: string): Promise<FeedbackEntry[]> {
    return await db.select().from(feedbackEntries).where(eq(feedbackEntries.submitterEmail, email));
  }

  async getFeedbackEntriesAboutPerson(personId: string): Promise<FeedbackEntry[]> {
    return await db.select().from(feedbackEntries).where(eq(feedbackEntries.aboutPersonId, personId));
  }

  async createFeedbackEntry(entry: InsertFeedbackEntry): Promise<FeedbackEntry> {
    const [newEntry] = await db.insert(feedbackEntries).values(entry).returning();
    return newEntry;
  }

  async clearAllFeedbackEntries(): Promise<void> {
    await db.delete(feedbackEntries);
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

  // Saved Reports (archived weekly snapshots - 2 per week: account + team)
  async getSavedReports(): Promise<SavedReport[]> {
    return await db.select().from(savedReports);
  }

  async getSavedReport(id: string): Promise<SavedReport | undefined> {
    const [report] = await db.select().from(savedReports).where(eq(savedReports.id, id));
    return report || undefined;
  }

  async getSavedReportByWeek(weekStart: string, reportType: SavedReportType): Promise<SavedReport | undefined> {
    const [report] = await db.select().from(savedReports).where(
      and(eq(savedReports.weekStart, weekStart), eq(savedReports.reportType, reportType))
    );
    return report || undefined;
  }

  async getSavedReportsByWeek(weekStart: string): Promise<SavedReport[]> {
    return await db.select().from(savedReports).where(eq(savedReports.weekStart, weekStart));
  }

  async upsertSavedReport(insertReport: InsertSavedReport): Promise<SavedReport> {
    const reportType = insertReport.reportType || 'account';
    // Check if exists first, then insert or update
    const existing = await this.getSavedReportByWeek(insertReport.weekStart, reportType as SavedReportType);
    if (existing) {
      const [updated] = await db
        .update(savedReports)
        .set({
          ...insertReport,
          reportType,
          savedAt: new Date(),
        })
        .where(eq(savedReports.id, existing.id))
        .returning();
      return updated;
    }
    const [report] = await db
      .insert(savedReports)
      .values({ ...insertReport, reportType })
      .returning();
    return report;
  }

  async updateSavedReportAiSummary(id: string, aiSummary: unknown): Promise<SavedReport | undefined> {
    const [updated] = await db
      .update(savedReports)
      .set({ aiSummary })
      .where(eq(savedReports.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteSavedReport(id: string): Promise<boolean> {
    const result = await db.delete(savedReports).where(eq(savedReports.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async deleteSavedReportsByWeek(weekStart: string): Promise<boolean> {
    const result = await db.delete(savedReports).where(eq(savedReports.weekStart, weekStart));
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

  // User role management
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(userData: { email: string; firstName?: string; lastName?: string; role: UserRole }): Promise<User> {
    const [user] = await db.insert(users).values({
      email: userData.email,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      role: userData.role,
    }).returning();
    return user;
  }

  async updateUserRole(userId: string, role: UserRole): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated || undefined;
  }

  async updateUserProfile(userId: string, updates: { displayName?: string }): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated || undefined;
  }

  async deleteUser(userId: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, userId));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Role requests
  async getRoleRequests(): Promise<RoleRequest[]> {
    return await db.select().from(roleRequests);
  }

  async getPendingRoleRequests(): Promise<RoleRequest[]> {
    return await db.select().from(roleRequests).where(eq(roleRequests.status, 'pending'));
  }

  async createRoleRequest(request: InsertRoleRequest): Promise<RoleRequest> {
    const [roleRequest] = await db.insert(roleRequests).values(request).returning();
    return roleRequest;
  }

  async updateRoleRequest(id: string, status: 'approved' | 'denied', resolvedBy: string): Promise<RoleRequest | undefined> {
    const [updated] = await db.update(roleRequests)
      .set({ status, resolvedBy, resolvedAt: new Date() })
      .where(eq(roleRequests.id, id))
      .returning();
    return updated || undefined;
  }
}

export const storage = new DatabaseStorage();
