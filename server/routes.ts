import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { JiraService } from "./services/jiraService";
import { insertPersonSchema, insertProjectSchema, insertWeeklyReportSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Team Members routes
  app.get('/api/team-members', async (_req, res) => {
    try {
      const members = await storage.getTeamMembers();
      res.json(members);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/team-members', async (req, res) => {
    try {
      const data = insertPersonSchema.parse(req.body);
      const member = await storage.createTeamMember(data);
      res.json(member);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch('/api/team-members/:id', async (req, res) => {
    try {
      const data = insertPersonSchema.partial().parse(req.body);
      const member = await storage.updateTeamMember(req.params.id, data);
      if (!member) {
        return res.status(404).json({ error: 'Team member not found' });
      }
      res.json(member);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/team-members/:id', async (req, res) => {
    try {
      const success = await storage.deleteTeamMember(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Team member not found' });
      }
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Project Leads routes
  app.get('/api/project-leads', async (_req, res) => {
    try {
      const leads = await storage.getProjectLeads();
      res.json(leads);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/project-leads', async (req, res) => {
    try {
      const data = insertPersonSchema.parse(req.body);
      const lead = await storage.createProjectLead(data);
      res.json(lead);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch('/api/project-leads/:id', async (req, res) => {
    try {
      const data = insertPersonSchema.partial().parse(req.body);
      const lead = await storage.updateProjectLead(req.params.id, data);
      if (!lead) {
        return res.status(404).json({ error: 'Project lead not found' });
      }
      res.json(lead);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/project-leads/:id', async (req, res) => {
    try {
      const success = await storage.deleteProjectLead(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Project lead not found' });
      }
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Projects routes
  app.get('/api/projects', async (_req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/projects', async (req, res) => {
    try {
      const data = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(data);
      res.json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch('/api/projects/:id', async (req, res) => {
    try {
      const data = insertProjectSchema.partial().parse(req.body);
      const project = await storage.updateProject(req.params.id, data);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      res.json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/projects/:id', async (req, res) => {
    try {
      const success = await storage.deleteProject(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Project not found' });
      }
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Weekly Reports routes
  app.get('/api/weekly-reports', async (_req, res) => {
    try {
      const reports = await storage.getWeeklyReports();
      res.json(reports);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/weekly-reports', async (req, res) => {
    try {
      const data = insertWeeklyReportSchema.parse(req.body);
      const report = await storage.createWeeklyReport(data);
      res.json(report);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch('/api/weekly-reports/:id', async (req, res) => {
    try {
      const data = insertWeeklyReportSchema.partial().parse(req.body);
      const report = await storage.updateWeeklyReport(req.params.id, data);
      if (!report) {
        return res.status(404).json({ error: 'Weekly report not found' });
      }
      res.json(report);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/weekly-reports/:id', async (req, res) => {
    try {
      const success = await storage.deleteWeeklyReport(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Weekly report not found' });
      }
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete all weekly reports
  app.delete('/api/weekly-reports', async (_req, res) => {
    try {
      const reports = await storage.getWeeklyReports();
      for (const report of reports) {
        await storage.deleteWeeklyReport(report.id);
      }
      res.json({ success: true, deleted: reports.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Import projects from Jira
  app.post('/api/jira/import', async (req, res) => {
    try {
      const { projectKey } = req.body;

      const jiraService = new JiraService();
      const importedProjects = await jiraService.getProjectsFromJira(projectKey);

      const peopleMap = new Map<string, string>();
      const leadsMap = new Map<string, string>();

      importedProjects.forEach((project) => {
        leadsMap.set(project.leadId, project.leadName);
        
        project.teamMemberIds.forEach((id, index) => {
          peopleMap.set(id, project.teamMemberNames[index]);
        });
      });

      const result = {
        projects: importedProjects.map((p) => ({
          name: p.name,
          customer: p.customer,
          leadId: p.leadId,
          teamMemberIds: p.teamMemberIds,
          startDate: p.startDate,
          endDate: p.endDate,
          epicKey: p.epicKey,
        })),
        leads: Array.from(leadsMap.entries()).map(([id, name]) => ({
          id,
          name,
        })),
        teamMembers: Array.from(peopleMap.entries()).map(([id, name]) => ({
          id,
          name,
        })),
      };

      res.json({
        success: true,
        data: result,
        message: `Successfully imported ${importedProjects.length} projects from Jira`,
      });
    } catch (error: any) {
      console.error('Error importing from Jira:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to import from Jira',
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
