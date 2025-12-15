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

  // Helper to check user role
  const getUserRole = async (userId: string): Promise<string> => {
    const user = await storage.getUser(userId);
    return user?.role || 'member';
  };

  // Role hierarchy for permission checking
  const roleHierarchy: Record<string, number> = {
    'admin': 4,
    'manager': 3,
    'lead': 2,
    'member': 1
  };

  const hasMinRole = (userRole: string, requiredRole: string): boolean => {
    return (roleHierarchy[userRole] || 0) >= (roleHierarchy[requiredRole] || 0);
  };

  // Permission definitions based on roles - must match frontend usePermissions.ts
  const ROLE_PERMISSIONS: Record<string, string[]> = {
    admin: [
      'canManageUsers', 'canViewAllReports', 'canSubmitReports', 'canEditReports', 
      'canDeleteReports', 'canAddTeamMembers', 'canEditTeamMembers', 'canAddProjectLeads', 
      'canEditProjectLeads', 'canDeletePeople',
      'canAddContracts', 'canEditContracts', 'canDeleteContracts', 'canGenerateAISummary',
      'canViewAISummary', 'canExportReports', 'canArchiveReports', 'canViewFeedback', 'canSubmitFeedback'
    ],
    manager: [
      'canViewAllReports', 'canSubmitReports', 'canEditReports', 'canDeleteReports',
      'canAddTeamMembers', 'canEditTeamMembers', 'canAddProjectLeads', 'canEditProjectLeads', 
      'canDeletePeople', 'canAddContracts', 
      'canEditContracts', 'canDeleteContracts', 'canGenerateAISummary', 'canViewAISummary',
      'canExportReports', 'canArchiveReports', 'canViewFeedback', 'canSubmitFeedback'
    ],
    lead: [
      'canViewAllReports', 'canSubmitReports', 'canEditReports',
      'canAddTeamMembers', 'canEditTeamMembers', 'canAddProjectLeads', 'canEditProjectLeads',
      'canAddContracts', 'canEditContracts',
      'canViewAISummary', 'canExportReports', 'canArchiveReports', 'canGenerateAISummary',
      'canViewFeedback', 'canSubmitFeedback'
    ],
    member: [
      'canViewAllReports', 'canViewAISummary', 'canViewFeedback', 'canSubmitFeedback',
      'canAddTeamMembers', 'canEditTeamMembers'
    ]
  };

  // Check if user has specific permission
  const hasPermission = (userRole: string, permission: string): boolean => {
    const permissions = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS['member'];
    return permissions.includes(permission);
  };

  // Middleware factory for permission checking
  const requirePermission = (permission: string) => {
    return async (req: any, res: any, next: any) => {
      try {
        const userId = req.user?.claims?.sub;
        if (!userId) {
          return res.status(401).json({ error: 'Not authenticated' });
        }
        const userRole = await getUserRole(userId);
        if (!hasPermission(userRole, permission)) {
          return res.status(403).json({ error: `Permission denied: ${permission} required` });
        }
        next();
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    };
  };

  // User profile routes
  app.patch('/api/users/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { displayName } = req.body;
      const updated = await storage.updateUserProfile(userId, { displayName });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get all users (admin only)
  app.get('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userRole = await getUserRole(userId);
      if (userRole !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create user (admin only) - for pre-configuring leads before they log in
  app.post('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const adminRole = await getUserRole(adminId);
      if (adminRole !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      const { email: rawEmail, firstName, lastName, role } = req.body;
      
      // Validate email
      if (!rawEmail || typeof rawEmail !== 'string') {
        return res.status(400).json({ error: 'Email is required' });
      }
      
      // Normalize email to lowercase for consistent comparison
      const email = rawEmail.trim().toLowerCase();
      
      // Validate email domain
      if (!email.endsWith('@ignitetech.com')) {
        return res.status(400).json({ error: 'Email must be from @ignitetech.com domain' });
      }
      
      // Validate role
      if (!['admin', 'manager', 'lead', 'member'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: 'User with this email already exists' });
      }
      
      const user = await storage.createUser({ email, firstName, lastName, role });
      res.status(201).json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update user role (admin only)
  app.patch('/api/users/:userId/role', isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const adminRole = await getUserRole(adminId);
      if (adminRole !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const { userId } = req.params;
      const { role } = req.body;
      if (!['admin', 'manager', 'lead', 'member'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      const updated = await storage.updateUserRole(userId, role);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete user (admin only)
  app.delete('/api/users/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const adminRole = await getUserRole(adminId);
      if (adminRole !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const { userId } = req.params;
      const success = await storage.deleteUser(userId);
      if (!success) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ message: 'User deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk update user roles (admin only)
  app.patch('/api/users/bulk-role', isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const adminRole = await getUserRole(adminId);
      if (adminRole !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const { userIds, role } = req.body;
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'userIds must be a non-empty array' });
      }
      if (!['admin', 'manager', 'lead', 'member'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      const results = await Promise.all(
        userIds.map(async (userId: string) => {
          try {
            await storage.updateUserRole(userId, role);
            return { userId, success: true };
          } catch (err) {
            return { userId, success: false, error: (err as Error).message };
          }
        })
      );
      const successCount = results.filter(r => r.success).length;
      res.json({ message: `Updated ${successCount} of ${userIds.length} users`, results });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk delete users (admin only)
  app.delete('/api/users/bulk', isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const adminRole = await getUserRole(adminId);
      if (adminRole !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const { userIds } = req.body;
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'userIds must be a non-empty array' });
      }
      const results = await Promise.all(
        userIds.map(async (userId: string) => {
          try {
            const success = await storage.deleteUser(userId);
            return { userId, success };
          } catch (err) {
            return { userId, success: false, error: (err as Error).message };
          }
        })
      );
      const successCount = results.filter(r => r.success).length;
      res.json({ message: `Deleted ${successCount} of ${userIds.length} users`, results });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin role switching (temporary override for testing)
  // This is stored in session/memory, not in database
  const adminRoleOverrides = new Map<string, string>(); // userId -> overrideRole

  app.post('/api/users/switch-role', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const actualUser = await storage.getUser(userId);
      if (actualUser?.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can switch roles' });
      }
      const { role } = req.body;
      if (role === 'admin' || !role) {
        // Clear override, use actual role
        adminRoleOverrides.delete(userId);
      } else if (['manager', 'lead', 'member'].includes(role)) {
        adminRoleOverrides.set(userId, role);
      }
      res.json({ 
        success: true, 
        effectiveRole: adminRoleOverrides.get(userId) || actualUser?.role,
        isOverridden: adminRoleOverrides.has(userId)
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get effective role (actual role or admin override)
  app.get('/api/users/effective-role', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const overrideRole = adminRoleOverrides.get(userId);
      res.json({
        actualRole: user?.role || 'member',
        effectiveRole: overrideRole || user?.role || 'member',
        isOverridden: !!overrideRole
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Role request routes
  app.get('/api/role-requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userRole = await getUserRole(userId);
      if (userRole !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const requests = await storage.getRoleRequests();
      res.json(requests);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/role-requests/pending', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userRole = await getUserRole(userId);
      if (userRole !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const requests = await storage.getPendingRoleRequests();
      res.json(requests);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/role-requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const { requestedRole, reason } = req.body;
      if (!['manager', 'lead', 'admin'].includes(requestedRole)) {
        return res.status(400).json({ error: 'Invalid requested role' });
      }
      const request = await storage.createRoleRequest({
        userId,
        userEmail: user?.email || '',
        currentRole: user?.role || 'member',
        requestedRole,
        reason,
        status: 'pending'
      });
      res.json(request);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/role-requests/:id', isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const adminRole = await getUserRole(adminId);
      if (adminRole !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const { id } = req.params;
      const { status } = req.body;
      if (!['approved', 'denied'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      const admin = await storage.getUser(adminId);
      const updated = await storage.updateRoleRequest(id, status, admin?.email || 'admin');
      
      // If approved, update the user's role
      if (status === 'approved' && updated) {
        await storage.updateUserRole(updated.userId, updated.requestedRole as any);
      }
      
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
  // Returns the current active week for report submission
  // Logic:
  // 1. If unarchived reports exist → use their weekStart (stay with those reports)
  // 2. If archives exist → use MAX(archived week, current calendar week)
  //    - If still in the archived week (force archive on Sat) → stay on that week
  //    - If calendar moved to new week → use current calendar week
  // 3. If no data → use current calendar week
  app.get('/api/reporting-week', isAuthenticated, async (_req, res) => {
    try {
      // Helper to calculate Monday of the current calendar week (UTC)
      const calculateCurrentWeekStart = () => {
        const now = new Date();
        // Get UTC date components
        const utcYear = now.getUTCFullYear();
        const utcMonth = now.getUTCMonth();
        const utcDate = now.getUTCDate();
        const utcDayOfWeek = now.getUTCDay();
        
        // Calculate days to go back to reach Monday
        const daysToMonday = (utcDayOfWeek + 6) % 7;
        
        // Create pure UTC date for Monday midnight
        const mondayUTC = new Date(Date.UTC(utcYear, utcMonth, utcDate - daysToMonday, 0, 0, 0, 0));
        
        const year = mondayUTC.getUTCFullYear();
        const month = String(mondayUTC.getUTCMonth() + 1).padStart(2, '0');
        const day = String(mondayUTC.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // Helper to calculate week end (Sunday) from week start (UTC)
      const calculateWeekEnd = (weekStart: string) => {
        const weekStartDate = new Date(weekStart + 'T00:00:00Z'); // Parse as UTC
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6);
        const endYear = weekEndDate.getUTCFullYear();
        const endMonth = String(weekEndDate.getUTCMonth() + 1).padStart(2, '0');
        const endDay = String(weekEndDate.getUTCDate()).padStart(2, '0');
        return `${endYear}-${endMonth}-${endDay}`;
      };

      // Priority 1: Check for existing unarchived weekly reports
      const weeklyReports = await storage.getWeeklyReports();
      
      if (weeklyReports.length > 0) {
        // Use the weekStart from existing reports (they define the active week)
        const existingWeekStart = weeklyReports[0].weekStart;
        res.json({ 
          weekStart: existingWeekStart, 
          weekEnd: calculateWeekEnd(existingWeekStart),
          source: 'existing-reports'
        });
        return;
      }

      // Priority 2: Check archives and compare with current calendar week
      const savedReports = await storage.getSavedReports();
      const currentCalendarWeek = calculateCurrentWeekStart();
      
      if (savedReports.length > 0) {
        // Find the most recent archived week
        const sortedReports = savedReports.sort((a, b) => 
          new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()
        );
        const latestArchivedWeekStart = sortedReports[0].weekStart;
        
        // Compare dates: use the LATER of (archived week, current calendar week)
        // This handles:
        // - Force archive on Dec 6 (Sat): calendar=Dec 1, archived=Dec 1 → stay on Dec 1
        // - Force archive on Dec 8 (Mon): calendar=Dec 8, archived=Dec 1 → advance to Dec 8
        // - Auto archive on Dec 10 (Wed): calendar=Dec 8, archived=Dec 1 → advance to Dec 8
        const archivedDate = new Date(latestArchivedWeekStart + 'T00:00:00');
        const calendarDate = new Date(currentCalendarWeek + 'T00:00:00');
        
        // If calendar week is after the archived week, use calendar week
        // If calendar week is same as or before archived week, use archived week
        // (same week = force archive mid-week, should stay on that week)
        let activeWeekStart: string;
        let source: string;
        
        if (calendarDate > archivedDate) {
          // Calendar has moved past the archived week → use current calendar week
          activeWeekStart = currentCalendarWeek;
          source = 'calendar-after-archive';
        } else {
          // Still in the same week as the archive (or earlier, edge case)
          // Stay on the archived week so users can continue submitting
          activeWeekStart = latestArchivedWeekStart;
          source = 'archive-same-week';
        }
        
        res.json({ 
          weekStart: activeWeekStart, 
          weekEnd: calculateWeekEnd(activeWeekStart),
          source
        });
      } else {
        // Priority 3: No archives and no existing reports - use current calendar week
        res.json({ 
          weekStart: currentCalendarWeek, 
          weekEnd: calculateWeekEnd(currentCalendarWeek),
          source: 'calendar'
        });
      }
    } catch (error: any) {
      console.error('Error getting reporting week:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all people (for resolving person names in feedback entries)
  app.get('/api/people', isAuthenticated, async (_req, res) => {
    try {
      const allPeople = await storage.getAllPeople();
      res.json(allPeople);
    } catch (error: any) {
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

  app.post('/api/team-members', isAuthenticated, requirePermission('canAddTeamMembers'), async (req, res) => {
    try {
      const data = insertPersonSchema.parse(req.body);
      const member = await storage.createTeamMember(data);
      res.json(member);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch('/api/team-members/:id', isAuthenticated, requirePermission('canEditTeamMembers'), async (req, res) => {
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

  app.delete('/api/team-members/:id', isAuthenticated, requirePermission('canDeletePeople'), async (req, res) => {
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

  app.post('/api/project-leads', isAuthenticated, requirePermission('canAddProjectLeads'), async (req, res) => {
    try {
      const data = insertPersonSchema.parse(req.body);
      const lead = await storage.createProjectLead(data);
      res.json(lead);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch('/api/project-leads/:id', isAuthenticated, requirePermission('canEditProjectLeads'), async (req, res) => {
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

  app.delete('/api/project-leads/:id', isAuthenticated, requirePermission('canDeletePeople'), async (req, res) => {
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

  // Get all feedback entries - returns all for admins/managers, only own submissions for leads/members
  app.get('/api/feedback-entries', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      // Admins and managers can view all feedback; leads/members only see their own submissions
      const canViewAll = user.role === 'admin' || user.role === 'manager';
      
      if (canViewAll) {
        const entries = await storage.getAllFeedbackEntries();
        res.json(entries);
      } else {
        // Leads and members can only see feedback they submitted
        const entries = await storage.getFeedbackEntriesBySubmitter(user.email || '');
        res.json(entries);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get all people with feedback (for Member Feedback section) - legacy endpoint for compatibility
  app.get('/api/people/feedback', isAuthenticated, async (_req, res) => {
    try {
      const allPeople = await storage.getAllPeople();
      const peopleWithFeedback = allPeople.filter(p => p.feedback && p.feedback.trim());
      res.json(peopleWithFeedback);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Anonymous feedback submission - creates feedback entry with submitter tracking
  app.post('/api/people/:id/feedback', isAuthenticated, requirePermission('canSubmitFeedback'), async (req: any, res) => {
    try {
      const { feedback } = req.body;
      if (!feedback || typeof feedback !== 'string' || !feedback.trim()) {
        return res.status(400).json({ error: 'Feedback is required' });
      }
      
      // Get current person (could be lead or member)
      const person = await storage.getPersonById(req.params.id);
      if (!person) {
        return res.status(404).json({ error: 'Person not found' });
      }
      
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Create a feedback entry with submitter tracking
      await storage.createFeedbackEntry({
        aboutPersonId: req.params.id,
        submitterEmail: user?.email || '',
        feedback: feedback.trim(),
      });
      
      // Also update the person's aggregated feedback field (for backward compatibility with AI summary)
      const existingFeedback = person.feedback || '';
      const updatedFeedback = existingFeedback 
        ? `${existingFeedback}\n\n${feedback.trim()}`
        : feedback.trim();
      
      const updated = await storage.updatePersonFeedback(req.params.id, updatedFeedback);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Clear all feedback (for archiving - requires canArchiveReports)
  app.delete('/api/people/feedback', isAuthenticated, requirePermission('canArchiveReports'), async (_req, res) => {
    try {
      await storage.clearAllFeedback();
      await storage.clearAllFeedbackEntries(); // Also clear feedback entries
      res.json({ success: true });
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

  app.post('/api/project-roles', isAuthenticated, requirePermission('canAddContracts'), async (req, res) => {
    try {
      const data = insertProjectRoleSchema.parse(req.body);
      const role = await storage.createProjectRole(data);
      res.json(role);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/project-roles/:id', isAuthenticated, requirePermission('canDeleteContracts'), async (req, res) => {
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

  // Seed default roles endpoint (admin/manager only)
  app.post('/api/project-roles/seed', isAuthenticated, requirePermission('canAddContracts'), async (_req, res) => {
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

  app.post('/api/projects', isAuthenticated, requirePermission('canAddContracts'), async (req, res) => {
    try {
      const data = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(data);
      res.json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch('/api/projects/:id', isAuthenticated, requirePermission('canEditContracts'), async (req, res) => {
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

  app.delete('/api/projects/:id', isAuthenticated, requirePermission('canDeleteContracts'), async (req, res) => {
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

  app.post('/api/weekly-reports', isAuthenticated, requirePermission('canSubmitReports'), async (req, res) => {
    try {
      const data = insertWeeklyReportSchema.parse(req.body);
      const report = await storage.createWeeklyReport(data);
      res.json(report);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch('/api/weekly-reports/:id', isAuthenticated, requirePermission('canEditReports'), async (req, res) => {
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

  app.delete('/api/weekly-reports/:id', isAuthenticated, requirePermission('canDeleteReports'), async (req, res) => {
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

  // Delete all weekly reports (protected - admin only)
  app.delete('/api/weekly-reports', isAuthenticated, requirePermission('canDeleteReports'), async (_req, res) => {
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

  // Delete current week's AI summary (for Force Reset) (protected - requires canGenerateAISummary)
  app.delete('/api/current-ai-summary/:weekStart', isAuthenticated, requirePermission('canGenerateAISummary'), async (req, res) => {
    try {
      await storage.deleteCurrentAiSummary(req.params.weekStart);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // AI Summary endpoint - Generate BOTH leadership and team insights from reports (protected)
  app.post('/api/weekly-reports/ai-summary', isAuthenticated, requirePermission('canGenerateAISummary'), async (_req, res) => {
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

      // Build context for TEAM MEMBER AI summary - use anonymous feedback from people table
      // This replaces the per-report feedback with aggregated anonymous feedback
      const allPeople = await storage.getAllPeople();
      const peopleWithFeedback = allPeople.filter((p: { feedback: string | null }) => p.feedback && p.feedback.trim());
      
      // Get projects each person is associated with (either as lead or team member)
      const teamFeedbackContext = peopleWithFeedback.map((person: { id: string; name: string; roles: string[]; feedback: string | null }) => {
        // Find projects where this person is a lead
        const ledProjects = projects.filter(p => 
          p.leadIds?.includes(person.id) || p.leadId === person.id
        ).map(p => p.name);
        
        // Find projects where this person is a team member
        const memberProjects = projects.filter(p => {
          const assignments = (p.teamMembers as { memberId: string; role: string }[]) || [];
          return assignments.some(a => a.memberId === person.id);
        }).map(p => p.name);
        
        const allProjectsSet = new Set([...ledProjects, ...memberProjects]);
        const allProjects = Array.from(allProjectsSet);
        const role = person.roles?.includes('project-lead') ? 'Lead' : 'Team Member';
        
        return {
          personName: person.name,
          role: role,
          projects: allProjects.length > 0 ? allProjects : ['Not currently assigned'],
          feedback: person.feedback
        };
      });

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
        const teamPrompt = `You are a senior HR analyst synthesizing anonymous feedback about team members and leads. This feedback was submitted anonymously by colleagues who worked with these individuals during the week. Your goal is to provide COMPREHENSIVE insights that help leadership understand team dynamics, recognize achievements, and address concerns proactively.

ANONYMOUS FEEDBACK DATA (feedback ABOUT each person from their colleagues):
${JSON.stringify(teamFeedbackContext, null, 2)}

Each entry contains:
- personName: The person this feedback is about
- role: Whether they are a Lead or Team Member
- projects: The projects they work on
- feedback: Anonymous feedback from colleagues who worked with them this week (may contain multiple dated entries)

INSTRUCTIONS:
- This is feedback ABOUT each person, not feedback FROM them
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

  app.post('/api/saved-reports', isAuthenticated, requirePermission('canArchiveReports'), async (req, res) => {
    try {
      // Log the size of incoming data for debugging
      const bodySize = JSON.stringify(req.body).length;
      console.log(`[Archive] Saving report - Body size: ${(bodySize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`[Archive] Week: ${req.body.weekStart} to ${req.body.weekEnd}`);
      console.log(`[Archive] Report type: ${req.body.reportType || 'account'}`);
      console.log(`[Archive] Report count: ${req.body.reportCount}`);
      console.log(`[Archive] PDF data length: ${req.body.pdfData?.length || 0} chars`);
      console.log(`[Archive] CSV data length: ${req.body.csvData?.length || 0} chars`);
      console.log(`[Archive] Has AI summary: ${!!req.body.aiSummary}`);
      
      const data = insertSavedReportSchema.parse(req.body);
      const report = await storage.upsertSavedReport(data);
      console.log(`[Archive] Successfully saved ${report.reportType} report for week ${report.weekStart}`);
      res.json(report);
    } catch (error: any) {
      console.error('[Archive] Error saving report:', error);
      console.error('[Archive] Error stack:', error.stack);
      res.status(400).json({ error: error.message });
    }
  });

  // Get reports by week (returns both account and team reports for a week)
  app.get('/api/saved-reports/week/:weekStart', isAuthenticated, async (req, res) => {
    try {
      const reports = await storage.getSavedReportsByWeek(req.params.weekStart);
      res.json(reports);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/saved-reports/:id', isAuthenticated, requirePermission('canArchiveReports'), async (req, res) => {
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

  // Import projects from Jira (protected - requires canAddContracts)
  app.post('/api/jira/import', isAuthenticated, requirePermission('canAddContracts'), async (req, res) => {
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
