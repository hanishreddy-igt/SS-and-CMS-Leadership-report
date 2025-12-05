import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { JiraService } from "./services/jiraService";
import { insertPersonSchema, insertProjectSchema, insertWeeklyReportSchema, insertSavedReportSchema, insertProjectRoleSchema } from "@shared/schema";
import { setupAuth, isAuthenticated } from "./replitAuth";
import OpenAI from "openai";

// Initialize OpenAI client using Replit AI Integrations
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

// In-memory store for project editing locks
// Maps projectId -> { userId, userName, timestamp }
interface ProjectLock {
  userId: string;
  userName: string;
  timestamp: Date;
}
const projectEditLocks = new Map<string, ProjectLock>();

// Clean up stale locks (older than 10 minutes) periodically
setInterval(() => {
  const now = Date.now();
  const staleThreshold = 10 * 60 * 1000; // 10 minutes
  Array.from(projectEditLocks.entries()).forEach(([projectId, lock]) => {
    if (now - lock.timestamp.getTime() > staleThreshold) {
      projectEditLocks.delete(projectId);
    }
  });
}, 60 * 1000); // Run every minute

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error: any) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Project Edit Lock routes (for preventing simultaneous editing)
  // Check if a project is currently being edited by someone
  app.get('/api/project-locks/:projectId', isAuthenticated, async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const currentUserId = req.user.claims.sub;
      const lock = projectEditLocks.get(projectId);
      
      if (lock && lock.userId !== currentUserId) {
        // Someone else is editing
        res.json({ 
          isLocked: true, 
          lockedBy: lock.userName,
          lockedAt: lock.timestamp
        });
      } else {
        res.json({ isLocked: false });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Acquire a lock on a project (when opening report modal)
  app.post('/api/project-locks/:projectId', isAuthenticated, async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const userName = user?.email?.split('@')[0] || 'Someone';
      
      const existingLock = projectEditLocks.get(projectId);
      
      // If already locked by someone else, return conflict
      if (existingLock && existingLock.userId !== userId) {
        return res.status(409).json({ 
          error: 'Project is already being edited',
          lockedBy: existingLock.userName,
          lockedAt: existingLock.timestamp
        });
      }
      
      // Acquire or refresh the lock
      projectEditLocks.set(projectId, {
        userId,
        userName,
        timestamp: new Date()
      });
      
      res.json({ success: true, lockAcquired: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Release a lock on a project (when closing report modal)
  app.delete('/api/project-locks/:projectId', isAuthenticated, async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const userId = req.user.claims.sub;
      
      const lock = projectEditLocks.get(projectId);
      
      // Only allow the lock holder to release the lock
      if (lock && lock.userId === userId) {
        projectEditLocks.delete(projectId);
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Active Reporting Week endpoint
  // Returns the current active week for report submission based on the latest archive
  // The reporting week stays open until archive runs (either auto or force)
  app.get('/api/reporting-week', isAuthenticated, async (_req, res) => {
    try {
      // Helper to calculate Monday of the current calendar week
      const calculateCurrentWeekStart = () => {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const daysToMonday = (dayOfWeek + 6) % 7;
        const monday = new Date(now);
        monday.setDate(now.getDate() - daysToMonday);
        monday.setHours(0, 0, 0, 0);
        const year = monday.getFullYear();
        const month = String(monday.getMonth() + 1).padStart(2, '0');
        const day = String(monday.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // Get saved reports (archived weeks)
      const savedReports = await storage.getSavedReports();
      
      if (savedReports.length > 0) {
        // Find the most recent archived week
        const sortedReports = savedReports.sort((a, b) => 
          new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()
        );
        const latestArchivedWeekStart = sortedReports[0].weekStart;
        
        // The active reporting week is the week AFTER the latest archive
        const latestArchiveDate = new Date(latestArchivedWeekStart + 'T00:00:00');
        const nextWeekMonday = new Date(latestArchiveDate);
        nextWeekMonday.setDate(latestArchiveDate.getDate() + 7);
        
        const year = nextWeekMonday.getFullYear();
        const month = String(nextWeekMonday.getMonth() + 1).padStart(2, '0');
        const day = String(nextWeekMonday.getDate()).padStart(2, '0');
        const activeWeekStart = `${year}-${month}-${day}`;
        
        // Calculate week end (Sunday)
        const weekEndDate = new Date(nextWeekMonday);
        weekEndDate.setDate(nextWeekMonday.getDate() + 6);
        const endYear = weekEndDate.getFullYear();
        const endMonth = String(weekEndDate.getMonth() + 1).padStart(2, '0');
        const endDay = String(weekEndDate.getDate()).padStart(2, '0');
        const activeWeekEnd = `${endYear}-${endMonth}-${endDay}`;
        
        res.json({ 
          weekStart: activeWeekStart, 
          weekEnd: activeWeekEnd,
          source: 'archive'
        });
      } else {
        // No archives exist - check for existing weekly reports
        const weeklyReports = await storage.getWeeklyReports();
        
        if (weeklyReports.length > 0) {
          // Use the weekStart from existing reports (should all be the same)
          const existingWeekStart = weeklyReports[0].weekStart;
          
          // Calculate week end (Sunday)
          const weekStartDate = new Date(existingWeekStart + 'T00:00:00');
          const weekEndDate = new Date(weekStartDate);
          weekEndDate.setDate(weekStartDate.getDate() + 6);
          const endYear = weekEndDate.getFullYear();
          const endMonth = String(weekEndDate.getMonth() + 1).padStart(2, '0');
          const endDay = String(weekEndDate.getDate()).padStart(2, '0');
          const activeWeekEnd = `${endYear}-${endMonth}-${endDay}`;
          
          res.json({ 
            weekStart: existingWeekStart, 
            weekEnd: activeWeekEnd,
            source: 'existing-reports'
          });
        } else {
          // No archives and no existing reports - use current calendar week
          const weekStart = calculateCurrentWeekStart();
          const weekStartDate = new Date(weekStart + 'T00:00:00');
          const weekEndDate = new Date(weekStartDate);
          weekEndDate.setDate(weekStartDate.getDate() + 6);
          const endYear = weekEndDate.getFullYear();
          const endMonth = String(weekEndDate.getMonth() + 1).padStart(2, '0');
          const endDay = String(weekEndDate.getDate()).padStart(2, '0');
          const weekEnd = `${endYear}-${endMonth}-${endDay}`;
          
          res.json({ 
            weekStart, 
            weekEnd,
            source: 'calendar'
          });
        }
      }
    } catch (error: any) {
      console.error('Error getting reporting week:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Team Members routes (protected)
  app.get('/api/team-members', isAuthenticated, async (_req, res) => {
    try {
      const members = await storage.getTeamMembers();
      res.json(members);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/team-members', isAuthenticated, async (req, res) => {
    try {
      const data = insertPersonSchema.parse(req.body);
      const member = await storage.createTeamMember(data);
      res.json(member);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch('/api/team-members/:id', isAuthenticated, async (req, res) => {
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

  app.delete('/api/team-members/:id', isAuthenticated, async (req, res) => {
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

  // Project Leads routes (protected)
  app.get('/api/project-leads', isAuthenticated, async (_req, res) => {
    try {
      const leads = await storage.getProjectLeads();
      res.json(leads);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/project-leads', isAuthenticated, async (req, res) => {
    try {
      const data = insertPersonSchema.parse(req.body);
      const lead = await storage.createProjectLead(data);
      res.json(lead);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch('/api/project-leads/:id', isAuthenticated, async (req, res) => {
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

  app.delete('/api/project-leads/:id', isAuthenticated, async (req, res) => {
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

  // Project Roles routes (protected)
  app.get('/api/project-roles', isAuthenticated, async (_req, res) => {
    try {
      const roles = await storage.getProjectRoles();
      res.json(roles);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/project-roles', isAuthenticated, async (req, res) => {
    try {
      const data = insertProjectRoleSchema.parse(req.body);
      const role = await storage.createProjectRole(data);
      res.json(role);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/project-roles/:id', isAuthenticated, async (req, res) => {
    try {
      const success = await storage.deleteProjectRole(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Role not found' });
      }
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Seed default roles endpoint
  app.post('/api/project-roles/seed', isAuthenticated, async (_req, res) => {
    try {
      await storage.seedDefaultRoles();
      const roles = await storage.getProjectRoles();
      res.json(roles);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Projects routes (protected)
  app.get('/api/projects', isAuthenticated, async (_req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/projects', isAuthenticated, async (req, res) => {
    try {
      const data = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(data);
      res.json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch('/api/projects/:id', isAuthenticated, async (req, res) => {
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

  app.delete('/api/projects/:id', isAuthenticated, async (req, res) => {
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

  // Weekly Reports routes (protected)
  app.get('/api/weekly-reports', isAuthenticated, async (_req, res) => {
    try {
      const reports = await storage.getWeeklyReports();
      res.json(reports);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/weekly-reports', isAuthenticated, async (req, res) => {
    try {
      const data = insertWeeklyReportSchema.parse(req.body);
      const report = await storage.createWeeklyReport(data);
      res.json(report);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch('/api/weekly-reports/:id', isAuthenticated, async (req, res) => {
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

  app.delete('/api/weekly-reports/:id', isAuthenticated, async (req, res) => {
    try {
      // First, get the report to know its projectId and weekStart
      const reportToDelete = await storage.getWeeklyReport(req.params.id);
      if (!reportToDelete) {
        return res.status(404).json({ error: 'Weekly report not found' });
      }
      
      const { projectId, weekStart } = reportToDelete;
      
      // Delete the report
      const success = await storage.deleteWeeklyReport(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Weekly report not found' });
      }
      
      // Check if there are other submitted reports for the same project/week
      const allReports = await storage.getWeeklyReports();
      const remainingReportsForProject = allReports.filter(
        r => r.projectId === projectId && 
             r.weekStart === weekStart && 
             r.status === 'submitted'
      );
      
      res.json({ 
        success: true, 
        remainingSubmittedCount: remainingReportsForProject.length,
        projectStillHasReport: remainingReportsForProject.length > 0
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete all weekly reports (protected)
  app.delete('/api/weekly-reports', isAuthenticated, async (_req, res) => {
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

  // Get current week's AI summary (protected)
  app.get('/api/current-ai-summary/:weekStart', isAuthenticated, async (req, res) => {
    try {
      const summary = await storage.getCurrentAiSummary(req.params.weekStart);
      if (!summary) {
        return res.json({ summary: null });
      }
      res.json({ 
        summary: summary.summary,
        reportsAnalyzed: parseInt(summary.reportsAnalyzed),
        generatedAt: summary.generatedAt.toISOString()
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete current week's AI summary (for Force Reset) (protected)
  app.delete('/api/current-ai-summary/:weekStart', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteCurrentAiSummary(req.params.weekStart);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // AI Summary endpoint - Generate BOTH leadership and team insights from reports (protected)
  app.post('/api/weekly-reports/ai-summary', isAuthenticated, async (_req, res) => {
    try {
      const reports = await storage.getWeeklyReports();
      const projects = await storage.getProjects();
      const leads = await storage.getProjectLeads();
      const teamMembers = await storage.getTeamMembers();
      
      if (reports.length === 0) {
        return res.json({ 
          summary: null, 
          teamSummary: null,
          message: 'No reports available to analyze' 
        });
      }

      // Get only submitted reports for current week
      const submittedReports = reports.filter(r => r.status === 'submitted');
      
      if (submittedReports.length === 0) {
        return res.json({ 
          summary: null, 
          teamSummary: null,
          message: 'No submitted reports available to analyze' 
        });
      }

      // Get the current week start from the reports
      const currentWeekStart = submittedReports[0]?.weekStart || '';

      // Build context for LEADERSHIP AI summary - only health status, progress, challenges, next week
      const leadershipContext = submittedReports.map(report => {
        const project = projects.find(p => p.id === report.projectId);
        const lead = leads.find(l => l.id === report.leadId);
        return {
          project: project?.name || 'Unknown Project',
          customer: project?.customer || 'Unknown Customer',
          lead: lead?.name || 'Unknown Lead',
          healthStatus: report.healthStatus,
          progress: report.progress,
          challenges: report.challenges,
          nextWeek: report.nextWeek
        };
      });

      const leadershipPrompt = `You are a senior executive assistant synthesizing weekly project reports for C-level leadership. You are analyzing ${submittedReports.length} project reports across the portfolio. Your goal is to provide a COMPREHENSIVE summary that eliminates the need for leadership to read individual reports.

REPORT DATA TO ANALYZE:
${JSON.stringify(leadershipContext, null, 2)}

INSTRUCTIONS:
- Be thorough and specific - name projects, customers, and leads where relevant
- Do NOT limit insights arbitrarily - include ALL significant items
- Focus on actionable intelligence that helps leadership make decisions
- Group related insights together for clarity

Generate a comprehensive executive summary in JSON format:
{
  "overallHealth": "on-track" | "needs-attention" | "critical",
  "executiveSummary": "A comprehensive 4-5 sentence synthesis of the week: overall portfolio health, major themes, critical concerns, and outlook. Be specific about numbers and trends.",
  
  "portfolioHealthBreakdown": {
    "onTrack": { "count": number, "projects": ["Project A (Customer) - Lead Name", ...] },
    "needsAttention": { "count": number, "projects": ["Project B (Customer) - Lead Name: brief reason", ...] },
    "critical": { "count": number, "projects": ["Project C (Customer) - Lead Name: brief reason", ...] }
  },
  
  "immediateAttentionRequired": [
    { "project": "Project Name", "customer": "Customer Name", "lead": "Lead Name", "issue": "Specific issue requiring leadership attention", "recommendedAction": "What leadership should do" }
  ],
  
  "keyAchievements": [
    { "project": "Project Name", "achievement": "Specific achievement or milestone", "impact": "Business impact or significance" }
  ],
  
  "crossProjectPatterns": {
    "commonChallenges": ["Pattern 1 affecting multiple projects", "Pattern 2", ...],
    "resourceConstraints": ["Any bandwidth, staffing, or capacity issues observed"],
    "processIssues": ["Any recurring process or workflow problems"]
  },
  
  "upcomingFocus": [
    { "project": "Project Name", "focus": "What the team will focus on next week", "priority": "high" | "medium" | "low" }
  ],
  
  "recommendedLeadershipActions": [
    { "action": "Specific action leadership should take", "priority": "high" | "medium", "rationale": "Why this matters" }
  ],
  
  "weekHighlights": ["Key highlight 1 with context", "Key highlight 2", ...]
}

IMPORTANT: 
- Include ALL projects in portfolioHealthBreakdown, not just a sample
- For immediateAttentionRequired, include any project that is critical or has significant blockers
- For upcomingFocus, summarize the next week priorities across projects, grouping similar focuses
- Be specific with project and customer names throughout`;

      // Build context for TEAM MEMBER AI summary - only team member feedback
      interface TeamMemberFeedbackItem {
        memberId: string;
        feedback: string;
      }
      
      const teamFeedbackContext = submittedReports.map(report => {
        const project = projects.find(p => p.id === report.projectId);
        const lead = leads.find(l => l.id === report.leadId);
        const feedback = (report.teamMemberFeedback as TeamMemberFeedbackItem[] | null) || [];
        
        // Enrich feedback with team member names
        const enrichedFeedback = feedback.map(f => {
          const member = teamMembers.find(m => m.id === f.memberId);
          return {
            memberName: member?.name || 'Unknown Member',
            feedback: f.feedback
          };
        }).filter(f => f.feedback && f.feedback.trim());
        
        return {
          project: project?.name || 'Unknown Project',
          lead: lead?.name || 'Unknown Lead',
          teamFeedback: enrichedFeedback
        };
      }).filter(r => r.teamFeedback.length > 0);

      // Generate leadership summary (increased token limit for comprehensive analysis)
      const leadershipResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: leadershipPrompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 4096,
      });

      const leadershipContent = leadershipResponse.choices[0]?.message?.content;
      if (!leadershipContent) {
        throw new Error('No response from AI for leadership summary');
      }

      const leadershipSummary = JSON.parse(leadershipContent);

      // Generate team summary only if there's feedback
      let teamSummary = null;
      if (teamFeedbackContext.length > 0) {
        const teamPrompt = `You are a senior HR analyst synthesizing team member feedback from weekly project reports. Your goal is to provide COMPREHENSIVE insights that help leadership understand team dynamics, recognize achievements, and address concerns proactively.

TEAM MEMBER FEEDBACK DATA:
${JSON.stringify(teamFeedbackContext, null, 2)}

INSTRUCTIONS:
- Be thorough - include ALL significant feedback, not just a sample
- Name specific team members when recognizing achievements or noting concerns
- Identify patterns across projects and teams
- Provide actionable recommendations for leadership

Generate a comprehensive team insights summary in JSON format:
{
  "overallTeamMorale": "positive" | "mixed" | "concerning",
  "teamSummary": "A comprehensive 4-5 sentence synthesis of team sentiment, key themes from feedback, notable achievements, and areas requiring attention. Be specific about patterns observed.",
  
  "teamHighlights": [
    { "memberName": "Name", "project": "Project Name", "highlight": "Specific positive observation or achievement" }
  ],
  
  "recognitionOpportunities": [
    { "memberName": "Name", "project": "Project Name", "achievement": "What they did", "suggestedRecognition": "How to recognize (shoutout, award, etc.)" }
  ],
  
  "teamConcerns": [
    { "concern": "Specific concern identified", "affectedMembers": ["Name 1", "Name 2"] or "general", "project": "Project Name or 'Multiple'", "severity": "high" | "medium" | "low" }
  ],
  
  "workloadObservations": [
    { "observation": "Workload pattern observed", "affectedMembers": ["Names"], "recommendation": "Suggested action" }
  ],
  
  "supportNeeded": [
    { "area": "Area where support is needed", "members": ["Names or 'team-wide'"], "suggestedSupport": "Specific support recommendation" }
  ],
  
  "developmentOpportunities": [
    { "memberName": "Name", "opportunity": "Training or growth opportunity identified", "rationale": "Why this would help" }
  ],
  
  "retentionRisks": [
    { "indicator": "Warning sign observed", "members": ["Names if identifiable"], "recommendedAction": "Proactive step to address" }
  ],
  
  "recommendedHRActions": [
    { "action": "Specific action for HR/leadership", "priority": "high" | "medium", "rationale": "Why this matters" }
  ]
}

IMPORTANT:
- Include ALL team members mentioned in feedback where relevant
- Be specific with names - leadership needs to know WHO to recognize or support
- If no concerns in a category, return an empty array
- Focus on actionable insights that help leadership engage with their team effectively`;

        const teamResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: teamPrompt }],
          response_format: { type: "json_object" },
          max_completion_tokens: 4096,
        });

        const teamContent = teamResponse.choices[0]?.message?.content;
        if (teamContent) {
          teamSummary = JSON.parse(teamContent);
        }
      }

      const generatedAt = new Date();
      
      // Persist the combined AI summary to the database
      const combinedSummary = {
        leadership: leadershipSummary,
        team: teamSummary
      };
      
      if (currentWeekStart) {
        await storage.upsertCurrentAiSummary({
          weekStart: currentWeekStart,
          summary: combinedSummary,
          reportsAnalyzed: String(submittedReports.length),
        });
      }
      
      res.json({ 
        summary: leadershipSummary,
        teamSummary: teamSummary,
        reportsAnalyzed: submittedReports.length,
        generatedAt: generatedAt.toISOString()
      });
    } catch (error: any) {
      console.error('AI Summary error:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to generate AI summary',
        summary: null,
        teamSummary: null
      });
    }
  });

  // Saved Reports routes - archived weekly report snapshots (protected)
  app.get('/api/saved-reports', isAuthenticated, async (_req, res) => {
    try {
      const reports = await storage.getSavedReports();
      // Sort by savedAt descending (most recent first)
      reports.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
      res.json(reports);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/saved-reports/:id', isAuthenticated, async (req, res) => {
    try {
      const report = await storage.getSavedReport(req.params.id);
      if (!report) {
        return res.status(404).json({ error: 'Saved report not found' });
      }
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/saved-reports', isAuthenticated, async (req, res) => {
    try {
      // Log the size of incoming data for debugging
      const bodySize = JSON.stringify(req.body).length;
      console.log(`[Archive] Saving report - Body size: ${(bodySize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`[Archive] Week: ${req.body.weekStart} to ${req.body.weekEnd}`);
      console.log(`[Archive] Report count: ${req.body.reportCount}`);
      console.log(`[Archive] PDF data length: ${req.body.pdfData?.length || 0} chars`);
      console.log(`[Archive] CSV data length: ${req.body.csvData?.length || 0} chars`);
      console.log(`[Archive] Has AI summary: ${!!req.body.aiSummary}`);
      
      const data = insertSavedReportSchema.parse(req.body);
      const report = await storage.upsertSavedReport(data);
      console.log(`[Archive] Successfully saved report for week ${report.weekStart}`);
      res.json(report);
    } catch (error: any) {
      console.error('[Archive] Error saving report:', error);
      console.error('[Archive] Error stack:', error.stack);
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/saved-reports/:id', isAuthenticated, async (req, res) => {
    try {
      const success = await storage.deleteSavedReport(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Saved report not found' });
      }
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Import projects from Jira (protected)
  app.post('/api/jira/import', isAuthenticated, async (req, res) => {
    try {
      const { projectKey } = req.body;

      const jiraService = new JiraService();
      const importedProjects = await jiraService.getProjectsFromJira(projectKey);

      const peopleMap = new Map<string, string>();
      const leadsMap = new Map<string, string>();

      importedProjects.forEach((project) => {
        leadsMap.set(project.leadId, project.leadName);
        
        // Collect team member names from the map
        project.teamMemberNames.forEach((name, id) => {
          peopleMap.set(id, name);
        });
      });

      const result = {
        projects: importedProjects.map((p) => ({
          name: p.name,
          customer: p.customer,
          leadId: p.leadId,
          teamMembers: p.teamMembers, // Now an array of {memberId, role}
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
