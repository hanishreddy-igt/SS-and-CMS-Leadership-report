import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { JiraService } from "./services/jiraService";

export async function registerRoutes(app: Express): Promise<Server> {
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
