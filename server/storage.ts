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
  Task,
  InsertTask,
  TaskTemplate,
  InsertTaskTemplate,
  TaskActivity,
  InsertTaskActivity,
} from "@shared/schema";
import { people, projects, weeklyReports, users, savedReports, currentAiSummary, projectRoles, roleRequests, feedbackEntries, tasks, taskTemplates, taskActivity } from "@shared/schema";
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

  // Unified People operations
  getAllPeople(): Promise<Person[]>;
  getPersonById(id: string): Promise<Person | undefined>;
  getPersonByEmail(email: string): Promise<Person | undefined>;
  createPerson(person: InsertPerson): Promise<Person>;
  updatePerson(id: string, updates: Partial<InsertPerson>): Promise<Person | undefined>;
  deletePerson(id: string): Promise<boolean>;
  addRoleToPerson(id: string, role: string): Promise<Person | undefined>;
  removeRoleFromPerson(id: string, role: string): Promise<Person | undefined>;
  updatePersonFeedback(id: string, feedback: string): Promise<Person | undefined>;
  clearAllFeedback(): Promise<void>;

  // Feedback entries (with submitter tracking)
  getAllFeedbackEntries(): Promise<FeedbackEntry[]>;
  getFeedbackEntryById(id: string): Promise<FeedbackEntry | undefined>;
  getFeedbackEntriesBySubmitter(email: string): Promise<FeedbackEntry[]>;
  getFeedbackEntriesAboutPerson(personId: string): Promise<FeedbackEntry[]>;
  createFeedbackEntry(entry: InsertFeedbackEntry): Promise<FeedbackEntry>;
  deleteFeedbackEntry(id: string): Promise<boolean>;
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

  // Task operations
  getTasks(): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  getTasksByCreator(createdBy: string): Promise<Task[]>;
  getTasksByAssignee(personId: string): Promise<Task[]>;
  getTasksByProject(projectId: string): Promise<Task[]>;
  getSubTasks(parentTaskId: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;

  // Task template operations
  getTaskTemplates(): Promise<TaskTemplate[]>;
  getTaskTemplate(id: string): Promise<TaskTemplate | undefined>;
  getTaskTemplatesByCreator(createdBy: string): Promise<TaskTemplate[]>;
  createTaskTemplate(template: InsertTaskTemplate): Promise<TaskTemplate>;
  updateTaskTemplate(id: string, template: Partial<InsertTaskTemplate> & { 
    lastUsedAt?: Date;
    nextTriggerAt?: string | null;
    nextDueAt?: string | null;
    lastTriggeredAt?: string | null;
  }): Promise<TaskTemplate | undefined>;
  deleteTaskTemplate(id: string): Promise<boolean>;

  // Task activity operations
  createTaskActivity(activity: InsertTaskActivity): Promise<TaskActivity>;
  getTaskActivities(taskId: string): Promise<TaskActivity[]>;
  getActivitiesByUser(userEmail: string, startDate?: Date, endDate?: Date): Promise<TaskActivity[]>;
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

  // Unified People operations for MemStorage
  async getAllPeople(): Promise<Person[]> {
    return Array.from(this.people.values());
  }

  async getPersonById(id: string): Promise<Person | undefined> {
    return this.people.get(id);
  }

  async getPersonByEmail(email: string): Promise<Person | undefined> {
    if (!email) return undefined;
    return Array.from(this.people.values()).find(
      p => p.email?.toLowerCase() === email.toLowerCase()
    );
  }

  async createPerson(insertPerson: InsertPerson): Promise<Person> {
    const id = randomUUID();
    const person: Person = {
      id,
      name: insertPerson.name,
      email: insertPerson.email ?? null,
      roles: insertPerson.roles ?? [],
      feedback: insertPerson.feedback ?? null,
    };
    this.people.set(id, person);
    return person;
  }

  async updatePerson(id: string, updates: Partial<InsertPerson>): Promise<Person | undefined> {
    const person = this.people.get(id);
    if (!person) return undefined;
    const updated = { ...person, ...updates };
    this.people.set(id, updated);
    return updated;
  }

  async deletePerson(id: string): Promise<boolean> {
    return this.people.delete(id);
  }

  async addRoleToPerson(id: string, role: string): Promise<Person | undefined> {
    const person = this.people.get(id);
    if (!person) return undefined;
    if (person.roles.includes(role)) return person; // Already has role
    const updated = { ...person, roles: [...person.roles, role] };
    this.people.set(id, updated);
    return updated;
  }

  async removeRoleFromPerson(id: string, role: string): Promise<Person | undefined> {
    const person = this.people.get(id);
    if (!person) return undefined;
    const updated = { ...person, roles: person.roles.filter(r => r !== role) };
    this.people.set(id, updated);
    return updated;
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

  async getFeedbackEntryById(id: string): Promise<FeedbackEntry | undefined> {
    return this.feedbackEntriesStore.get(id);
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

  async deleteFeedbackEntry(id: string): Promise<boolean> {
    return this.feedbackEntriesStore.delete(id);
  }

  async clearAllFeedbackEntries(): Promise<void> {
    this.feedbackEntriesStore.clear();
  }

  // Task operations for MemStorage
  private tasksStore: Map<string, Task> = new Map();

  async getTasks(): Promise<Task[]> {
    return Array.from(this.tasksStore.values());
  }

  async getTask(id: string): Promise<Task | undefined> {
    return this.tasksStore.get(id);
  }

  async getTasksByCreator(createdBy: string): Promise<Task[]> {
    return Array.from(this.tasksStore.values()).filter(t => t.createdBy === createdBy);
  }

  async getTasksByAssignee(personId: string): Promise<Task[]> {
    return Array.from(this.tasksStore.values()).filter(t => t.assignedTo.includes(personId));
  }

  async getTasksByProject(projectId: string): Promise<Task[]> {
    return Array.from(this.tasksStore.values()).filter(t => t.projectId === projectId);
  }

  async getSubTasks(parentTaskId: string): Promise<Task[]> {
    return Array.from(this.tasksStore.values()).filter(t => t.parentTaskId === parentTaskId);
  }

  async createTask(task: InsertTask): Promise<Task> {
    const id = randomUUID();
    const now = new Date();
    const newTask: Task = {
      id,
      title: task.title,
      description: task.description ?? null,
      projectId: task.projectId ?? null,
      parentTaskId: task.parentTaskId ?? null,
      assignedTo: task.assignedTo ?? [],
      createdBy: task.createdBy,
      updatedBy: null,
      status: task.status ?? 'todo',
      priority: task.priority ?? 'normal',
      tags: task.tags ?? [],
      notes: task.notes ?? [],
      dueDate: task.dueDate ?? null,
      sortOrder: task.sortOrder ?? '0',
      isExpanded: task.isExpanded ?? 'true',
      createdAt: now,
      updatedAt: now,
    };
    this.tasksStore.set(id, newTask);
    return newTask;
  }

  async updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined> {
    const task = this.tasksStore.get(id);
    if (!task) return undefined;

    // If task has sub-tasks and trying to update status, prevent it
    if (updates.status !== undefined) {
      const subTasks = await this.getSubTasks(id);
      if (subTasks.length > 0) {
        delete updates.status;
      }
    }

    const updated: Task = { ...task, ...updates, updatedAt: new Date() };
    this.tasksStore.set(id, updated);

    // If this task has a parent and status was changed, update parent status
    if (updated.parentTaskId && updates.status !== undefined) {
      await this.updateParentTaskStatusMem(updated.parentTaskId);
    }

    return updated;
  }

  private async updateParentTaskStatusMem(parentId: string): Promise<void> {
    const subTasks = await this.getSubTasks(parentId);
    if (subTasks.length === 0) return;

    const allDone = subTasks.every(t => t.status === 'done');
    const anyInProgress = subTasks.some(t => t.status === 'in-progress' || t.status === 'blocked');
    const anyDone = subTasks.some(t => t.status === 'done');

    let newStatus: string;
    if (allDone) {
      newStatus = 'done';
    } else if (anyInProgress || anyDone) {
      newStatus = 'in-progress';
    } else {
      newStatus = 'todo';
    }

    const parent = this.tasksStore.get(parentId);
    if (parent) {
      parent.status = newStatus;
      parent.updatedAt = new Date();
      this.tasksStore.set(parentId, parent);

      if (parent.parentTaskId) {
        await this.updateParentTaskStatusMem(parent.parentTaskId);
      }
    }
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.tasksStore.delete(id);
  }

  // Task template operations for MemStorage
  private taskTemplatesStore: Map<string, TaskTemplate> = new Map();

  async getTaskTemplates(): Promise<TaskTemplate[]> {
    return Array.from(this.taskTemplatesStore.values());
  }

  async getTaskTemplate(id: string): Promise<TaskTemplate | undefined> {
    return this.taskTemplatesStore.get(id);
  }

  async getTaskTemplatesByCreator(createdBy: string): Promise<TaskTemplate[]> {
    return Array.from(this.taskTemplatesStore.values()).filter(t => t.createdBy === createdBy);
  }

  async createTaskTemplate(template: InsertTaskTemplate): Promise<TaskTemplate> {
    const id = randomUUID();
    const newTemplate: TaskTemplate = {
      id,
      name: template.name,
      description: template.description ?? null,
      projectId: template.projectId ?? null,
      assignedTo: template.assignedTo ?? [],
      assignmentMode: template.assignmentMode ?? 'single',
      subTemplates: template.subTemplates ?? [],
      taskItems: template.taskItems ?? null,
      recurrence: template.recurrence ?? null,
      createdBy: template.createdBy,
      isActive: template.isActive ?? 'true',
      lastUsedAt: null,
      createdAt: new Date(),
    };
    this.taskTemplatesStore.set(id, newTemplate);
    return newTemplate;
  }

  async updateTaskTemplate(id: string, updates: Partial<InsertTaskTemplate> & { 
    lastUsedAt?: Date;
    nextTriggerAt?: string | null;
    nextDueAt?: string | null;
    lastTriggeredAt?: string | null;
  }): Promise<TaskTemplate | undefined> {
    const template = this.taskTemplatesStore.get(id);
    if (!template) return undefined;
    const updated: TaskTemplate = { ...template, ...updates };
    this.taskTemplatesStore.set(id, updated);
    return updated;
  }

  async deleteTaskTemplate(id: string): Promise<boolean> {
    return this.taskTemplatesStore.delete(id);
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

  // Unified People operations for DatabaseStorage
  async getPersonById(id: string): Promise<Person | undefined> {
    const [person] = await db.select().from(people).where(eq(people.id, id));
    return person || undefined;
  }

  async getPersonByEmail(email: string): Promise<Person | undefined> {
    if (!email) return undefined;
    const allPeople = await db.select().from(people);
    return allPeople.find(p => p.email?.toLowerCase() === email.toLowerCase());
  }

  async getAllPeople(): Promise<Person[]> {
    return await db.select().from(people);
  }

  async createPerson(insertPerson: InsertPerson): Promise<Person> {
    const [person] = await db.insert(people).values(insertPerson).returning();
    return person;
  }

  async updatePerson(id: string, updates: Partial<InsertPerson>): Promise<Person | undefined> {
    const [updated] = await db.update(people).set(updates).where(eq(people.id, id)).returning();
    return updated || undefined;
  }

  async deletePerson(id: string): Promise<boolean> {
    const result = await db.delete(people).where(eq(people.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async addRoleToPerson(id: string, role: string): Promise<Person | undefined> {
    const person = await this.getPersonById(id);
    if (!person) return undefined;
    if (person.roles.includes(role)) return person; // Already has role
    const newRoles = [...person.roles, role];
    const [updated] = await db.update(people).set({ roles: newRoles }).where(eq(people.id, id)).returning();
    return updated || undefined;
  }

  async removeRoleFromPerson(id: string, role: string): Promise<Person | undefined> {
    const person = await this.getPersonById(id);
    if (!person) return undefined;
    const newRoles = person.roles.filter(r => r !== role);
    const [updated] = await db.update(people).set({ roles: newRoles }).where(eq(people.id, id)).returning();
    return updated || undefined;
  }

  async updatePersonFeedback(id: string, feedback: string): Promise<Person | undefined> {
    const [updated] = await db.update(people).set({ feedback }).where(eq(people.id, id)).returning();
    return updated || undefined;
  }

  async clearAllFeedback(): Promise<void> {
    await db.update(people).set({ feedback: null });
  }

  // Feedback entries (with submitter tracking) - DatabaseStorage
  async getAllFeedbackEntries(): Promise<FeedbackEntry[]> {
    return await db.select().from(feedbackEntries);
  }

  async getFeedbackEntryById(id: string): Promise<FeedbackEntry | undefined> {
    const [entry] = await db.select().from(feedbackEntries).where(eq(feedbackEntries.id, id));
    return entry;
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

  async deleteFeedbackEntry(id: string): Promise<boolean> {
    const result = await db.delete(feedbackEntries).where(eq(feedbackEntries.id, id)).returning();
    return result.length > 0;
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

  // Task operations for DatabaseStorage
  async getTasks(): Promise<Task[]> {
    return await db.select().from(tasks);
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task || undefined;
  }

  async getTasksByCreator(createdBy: string): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.createdBy, createdBy));
  }

  async getTasksByAssignee(personId: string): Promise<Task[]> {
    const allTasks = await db.select().from(tasks);
    return allTasks.filter(t => t.assignedTo.includes(personId));
  }

  async getTasksByProject(projectId: string): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.projectId, projectId));
  }

  async getSubTasks(parentTaskId: string): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.parentTaskId, parentTaskId));
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values({
      ...task,
      assignedTo: task.assignedTo ?? [],
      tags: task.tags ?? [],
      notes: task.notes ?? [],
    }).returning();
    return newTask;
  }

  async updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined> {
    // Get current task first to check relationships
    const [currentTask] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!currentTask) return undefined;

    // If task has sub-tasks and trying to update status, prevent it
    if (updates.status !== undefined) {
      const subTasks = await this.getSubTasks(id);
      if (subTasks.length > 0) {
        // Remove status from updates - parent status is controlled by sub-tasks
        delete updates.status;
      }
    }

    // Update the task
    const [updated] = await db.update(tasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    
    if (!updated) return undefined;

    // If this task has a parent and status was changed, update parent status
    if (updated.parentTaskId && updates.status !== undefined) {
      await this.updateParentTaskStatus(updated.parentTaskId);
    }

    return updated;
  }

  private async updateParentTaskStatus(parentId: string): Promise<void> {
    const subTasks = await this.getSubTasks(parentId);
    if (subTasks.length === 0) return;

    // Determine parent status based on sub-task statuses
    const allDone = subTasks.every(t => t.status === 'done');
    const anyInProgress = subTasks.some(t => t.status === 'in-progress' || t.status === 'blocked');
    const anyDone = subTasks.some(t => t.status === 'done');

    let newStatus: string;
    if (allDone) {
      newStatus = 'done';
    } else if (anyInProgress || anyDone) {
      newStatus = 'in-progress';
    } else {
      newStatus = 'todo';
    }

    // Update parent directly without going through updateTask to avoid infinite recursion
    await db.update(tasks)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(tasks.id, parentId));
    
    // Check if parent also has a parent (grandparent) - propagate up the chain
    const [parent] = await db.select().from(tasks).where(eq(tasks.id, parentId));
    if (parent?.parentTaskId) {
      await this.updateParentTaskStatus(parent.parentTaskId);
    }
  }

  async deleteTask(id: string): Promise<boolean> {
    const result = await db.delete(tasks).where(eq(tasks.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Task template operations for DatabaseStorage
  async getTaskTemplates(): Promise<TaskTemplate[]> {
    return await db.select().from(taskTemplates);
  }

  async getTaskTemplate(id: string): Promise<TaskTemplate | undefined> {
    const [template] = await db.select().from(taskTemplates).where(eq(taskTemplates.id, id));
    return template || undefined;
  }

  async getTaskTemplatesByCreator(createdBy: string): Promise<TaskTemplate[]> {
    return await db.select().from(taskTemplates).where(eq(taskTemplates.createdBy, createdBy));
  }

  async createTaskTemplate(template: InsertTaskTemplate): Promise<TaskTemplate> {
    const [newTemplate] = await db.insert(taskTemplates).values(template).returning();
    return newTemplate;
  }

  async updateTaskTemplate(id: string, updates: Partial<InsertTaskTemplate> & { 
    lastUsedAt?: Date;
    nextTriggerAt?: string | null;
    nextDueAt?: string | null;
    lastTriggeredAt?: string | null;
  }): Promise<TaskTemplate | undefined> {
    const [updated] = await db.update(taskTemplates)
      .set(updates)
      .where(eq(taskTemplates.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteTaskTemplate(id: string): Promise<boolean> {
    const result = await db.delete(taskTemplates).where(eq(taskTemplates.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async mergeDuplicatePeople(): Promise<{ mergedCount: number; projectsUpdated: number; details: { email: string; mergedIds: string[]; keepId: string }[] }> {
    const allPeople = await this.getAllPeople();
    const allProjects = await this.getProjects();
    const emailMap = new Map<string, Person[]>();
    
    for (const person of allPeople) {
      if (!person.email) continue;
      const normalizedEmail = person.email.toLowerCase();
      const existing = emailMap.get(normalizedEmail) || [];
      existing.push(person);
      emailMap.set(normalizedEmail, existing);
    }
    
    let mergedCount = 0;
    let projectsUpdated = 0;
    const details: { email: string; mergedIds: string[]; keepId: string }[] = [];
    
    // Build a map of old IDs to new (primary) IDs for all duplicates
    const idRemapMap = new Map<string, string>();
    
    const entries = Array.from(emailMap.entries());
    for (const [email, duplicates] of entries) {
      if (duplicates.length <= 1) continue;
      
      const primary = duplicates[0];
      const mergedRoles = new Set<string>(primary.roles);
      const duplicateIds: string[] = [];
      
      for (let i = 1; i < duplicates.length; i++) {
        const dup = duplicates[i];
        for (const role of dup.roles) {
          mergedRoles.add(role);
        }
        idRemapMap.set(dup.id, primary.id);
        duplicateIds.push(dup.id);
      }
      
      // Update the primary person with merged roles
      await this.updatePerson(primary.id, { roles: Array.from(mergedRoles) as string[] });
      
      details.push({
        email,
        mergedIds: duplicateIds,
        keepId: primary.id
      });
      
      mergedCount += duplicateIds.length;
    }
    
    // Now update all projects to remap any duplicate IDs to the primary IDs
    for (const project of allProjects) {
      let needsUpdate = false;
      const updates: any = {};
      
      // Remap leadId
      if (project.leadId && idRemapMap.has(project.leadId)) {
        updates.leadId = idRemapMap.get(project.leadId);
        needsUpdate = true;
      }
      
      // Remap leadIds array
      if (project.leadIds && project.leadIds.length > 0) {
        const newLeadIds = project.leadIds.map((id: string) => idRemapMap.get(id) || id);
        // Remove duplicates that might result from remapping
        const uniqueLeadIds = Array.from(new Set<string>(newLeadIds));
        if (JSON.stringify(uniqueLeadIds) !== JSON.stringify(project.leadIds)) {
          updates.leadIds = uniqueLeadIds;
          needsUpdate = true;
        }
      }
      
      // Remap leadAssignments
      if (project.leadAssignments && Array.isArray(project.leadAssignments)) {
        const leadAssignments = project.leadAssignments as { leadId: string; hours?: string }[];
        const remappedAssignments: { leadId: string; hours?: string }[] = [];
        const seenLeadIds = new Set<string>();
        
        for (const assignment of leadAssignments) {
          const newLeadId = idRemapMap.get(assignment.leadId) || assignment.leadId;
          if (!seenLeadIds.has(newLeadId)) {
            seenLeadIds.add(newLeadId);
            remappedAssignments.push({ ...assignment, leadId: newLeadId });
          }
        }
        
        if (JSON.stringify(remappedAssignments) !== JSON.stringify(leadAssignments)) {
          updates.leadAssignments = remappedAssignments;
          needsUpdate = true;
        }
      }
      
      // Remap teamMembers
      if (project.teamMembers && Array.isArray(project.teamMembers)) {
        const teamMembers = project.teamMembers as { memberId: string; role?: string; hours?: string }[];
        const remappedMembers: { memberId: string; role?: string; hours?: string }[] = [];
        const seenMemberIds = new Set<string>();
        
        for (const member of teamMembers) {
          const newMemberId = idRemapMap.get(member.memberId) || member.memberId;
          if (!seenMemberIds.has(newMemberId)) {
            seenMemberIds.add(newMemberId);
            remappedMembers.push({ ...member, memberId: newMemberId });
          }
        }
        
        if (JSON.stringify(remappedMembers) !== JSON.stringify(teamMembers)) {
          updates.teamMembers = remappedMembers;
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        await this.updateProject(project.id, updates);
        projectsUpdated++;
      }
    }
    
    // Now safely delete the duplicate people (after project references are updated)
    const idsToDelete = Array.from(idRemapMap.keys());
    for (const oldId of idsToDelete) {
      await this.deletePerson(oldId);
    }
    
    return { mergedCount, projectsUpdated, details };
  }

  async cleanupOrphanedReferences(): Promise<{ projectsUpdated: number; orphanedLeadsRemoved: number; orphanedMembersRemoved: number }> {
    const allProjects = await this.getProjects();
    const allPeople = await this.getAllPeople();
    const validPersonIds = new Set(allPeople.map(p => p.id));
    
    let projectsUpdated = 0;
    let orphanedLeadsRemoved = 0;
    let orphanedMembersRemoved = 0;
    
    for (const project of allProjects) {
      let needsUpdate = false;
      const updates: any = {};
      
      // First, clean up leadIds array to get valid leads
      let validLeadIds: string[] = [];
      if (project.leadIds && project.leadIds.length > 0) {
        validLeadIds = project.leadIds.filter((id: string) => validPersonIds.has(id));
        if (validLeadIds.length !== project.leadIds.length) {
          orphanedLeadsRemoved += project.leadIds.length - validLeadIds.length;
          updates.leadIds = validLeadIds;
          needsUpdate = true;
        }
      }
      
      // Clean up leadId - if orphaned, replace with first valid lead from leadIds
      // IMPORTANT: Never set leadId to null due to NOT NULL constraint
      if (project.leadId && !validPersonIds.has(project.leadId)) {
        orphanedLeadsRemoved++;
        if (validLeadIds.length > 0) {
          updates.leadId = validLeadIds[0];
          needsUpdate = true;
        }
        // If no valid leads exist, we cannot update leadId (NOT NULL constraint)
        // The orphaned leadId will remain until a valid lead is manually assigned
      }
      
      // Clean up leadAssignments
      if (project.leadAssignments && Array.isArray(project.leadAssignments)) {
        const leadAssignments = project.leadAssignments as { leadId: string; hours?: string }[];
        const validAssignments = leadAssignments.filter(a => validPersonIds.has(a.leadId));
        if (validAssignments.length !== leadAssignments.length) {
          updates.leadAssignments = validAssignments;
          needsUpdate = true;
        }
      }
      
      // Clean up teamMembers
      if (project.teamMembers && Array.isArray(project.teamMembers)) {
        const teamMembers = project.teamMembers as { memberId: string; role?: string; hours?: string }[];
        const validMembers = teamMembers.filter(m => validPersonIds.has(m.memberId));
        if (validMembers.length !== teamMembers.length) {
          orphanedMembersRemoved += teamMembers.length - validMembers.length;
          updates.teamMembers = validMembers;
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        await this.updateProject(project.id, updates);
        projectsUpdated++;
      }
    }
    
    return { projectsUpdated, orphanedLeadsRemoved, orphanedMembersRemoved };
  }

  // Task activity operations
  async createTaskActivity(activity: InsertTaskActivity): Promise<TaskActivity> {
    const [created] = await db.insert(taskActivity).values(activity).returning();
    return created;
  }

  async getTaskActivities(taskId: string): Promise<TaskActivity[]> {
    return await db.select().from(taskActivity).where(eq(taskActivity.taskId, taskId));
  }

  async getActivitiesByUser(userEmail: string, startDate?: Date, endDate?: Date): Promise<TaskActivity[]> {
    const conditions = [eq(taskActivity.changedBy, userEmail)];
    
    if (startDate && endDate) {
      // For date range queries, we'll need to import gte and lte
      const { gte, lte } = await import('drizzle-orm');
      conditions.push(gte(taskActivity.changedAt, startDate));
      conditions.push(lte(taskActivity.changedAt, endDate));
    }
    
    return await db.select().from(taskActivity).where(and(...conditions));
  }
}

export const storage = new DatabaseStorage();
