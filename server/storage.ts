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
} from "@shared/schema";

export interface IStorage {
  // Team Members
  getTeamMembers(): Promise<TeamMember[]>;
  getTeamMember(id: string): Promise<TeamMember | undefined>;
  createTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  updateTeamMember(id: string, member: Partial<InsertTeamMember>): Promise<TeamMember | undefined>;
  deleteTeamMember(id: string): Promise<boolean>;

  // Project Leads
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
}

export class MemStorage implements IStorage {
  private teamMembers: Map<string, TeamMember>;
  private projectLeads: Map<string, ProjectLead>;
  private projects: Map<string, Project>;
  private weeklyReports: Map<string, WeeklyReport>;

  constructor() {
    this.teamMembers = new Map();
    this.projectLeads = new Map();
    this.projects = new Map();
    this.weeklyReports = new Map();
  }

  // Team Members
  async getTeamMembers(): Promise<TeamMember[]> {
    return Array.from(this.teamMembers.values());
  }

  async getTeamMember(id: string): Promise<TeamMember | undefined> {
    return this.teamMembers.get(id);
  }

  async createTeamMember(insertMember: InsertTeamMember): Promise<TeamMember> {
    const id = randomUUID();
    const member: TeamMember = { ...insertMember, id };
    this.teamMembers.set(id, member);
    return member;
  }

  async updateTeamMember(id: string, updates: Partial<InsertTeamMember>): Promise<TeamMember | undefined> {
    const member = this.teamMembers.get(id);
    if (!member) return undefined;
    const updated = { ...member, ...updates };
    this.teamMembers.set(id, updated);
    return updated;
  }

  async deleteTeamMember(id: string): Promise<boolean> {
    return this.teamMembers.delete(id);
  }

  // Project Leads
  async getProjectLeads(): Promise<ProjectLead[]> {
    return Array.from(this.projectLeads.values());
  }

  async getProjectLead(id: string): Promise<ProjectLead | undefined> {
    return this.projectLeads.get(id);
  }

  async createProjectLead(insertLead: InsertProjectLead): Promise<ProjectLead> {
    const id = randomUUID();
    const lead: ProjectLead = { ...insertLead, id };
    this.projectLeads.set(id, lead);
    return lead;
  }

  async updateProjectLead(id: string, updates: Partial<InsertProjectLead>): Promise<ProjectLead | undefined> {
    const lead = this.projectLeads.get(id);
    if (!lead) return undefined;
    const updated = { ...lead, ...updates };
    this.projectLeads.set(id, updated);
    return updated;
  }

  async deleteProjectLead(id: string): Promise<boolean> {
    return this.projectLeads.delete(id);
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
    const project: Project = { ...insertProject, id };
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
      teamMemberFeedback: insertReport.teamMemberFeedback ?? null,
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
}

export const storage = new MemStorage();
