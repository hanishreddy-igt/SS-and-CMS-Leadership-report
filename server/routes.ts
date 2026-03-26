import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { JiraService } from "./services/jiraService";
import { insertPersonSchema, insertProjectSchema, insertWeeklyReportSchema, insertSavedReportSchema, insertProjectRoleSchema, insertTaskSchema, insertTaskTemplateSchema } from "@shared/schema";
import { setupAuth, isAuthenticated } from "./replitAuth";
import OpenAI from "openai";
import { createTasksFromTemplate, calculateNextOccurrence, calculateNextOccurrenceAfterTrigger } from "./scheduler-utils";

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

  // Admin role switching (temporary override for testing)
  // This is stored in session/memory, not in database
  const adminRoleOverrides = new Map<string, string>(); // userId -> overrideRole

  // Helper to check user role (uses effective role if admin has switched)
  const getUserRole = async (userId: string): Promise<string> => {
    // Check if admin has an active role override
    const overrideRole = adminRoleOverrides.get(userId);
    if (overrideRole) {
      return overrideRole;
    }
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

  // Helper function to parse CSV lines with quoted fields
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
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
      'canRegenerateAISummary', 'canViewAISummary', 'canExportReports', 'canArchiveReports', 
      'canViewFeedback', 'canSubmitFeedback', 'canDeleteTeamFeedback', 'canManageTasks'
    ],
    manager: [
      'canViewAllReports', 'canSubmitReports', 'canEditReports', 'canDeleteReports',
      'canAddTeamMembers', 'canEditTeamMembers', 'canAddProjectLeads', 'canEditProjectLeads', 
      'canDeletePeople', 'canAddContracts', 
      'canEditContracts', 'canDeleteContracts', 'canGenerateAISummary', 'canRegenerateAISummary',
      'canViewAISummary', 'canExportReports', 'canArchiveReports', 'canViewFeedback', 
      'canSubmitFeedback', 'canDeleteTeamFeedback', 'canManageTasks'
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
      'canAddTeamMembers', 'canEditTeamMembers', 'canEditContracts',
      'canEditReports'
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
      
      // Validate email domain - allow ignitetech.com and khoros.com
      const allowedDomains = ['@ignitetech.com', '@khoros.com'];
      if (!allowedDomains.some(domain => email.endsWith(domain))) {
        return res.status(400).json({ error: 'Email must be from @ignitetech.com or @khoros.com domain' });
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

      // Priority 2: Check archives and determine which week should be active
      // KEY RULE: Only advance to the next week if the previous week was archived
      const savedReports = await storage.getSavedReports();
      const currentCalendarWeek = calculateCurrentWeekStart();
      
      if (savedReports.length > 0) {
        // Find the most recent archived week
        const sortedReports = savedReports.sort((a, b) => 
          new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()
        );
        const latestArchivedWeekStart = sortedReports[0].weekStart;
        
        // Calculate the week AFTER the latest archived week
        const latestArchivedDate = new Date(latestArchivedWeekStart + 'T00:00:00Z');
        const nextWeekAfterArchive = new Date(latestArchivedDate);
        nextWeekAfterArchive.setUTCDate(latestArchivedDate.getUTCDate() + 7);
        const nextWeekStart = `${nextWeekAfterArchive.getUTCFullYear()}-${String(nextWeekAfterArchive.getUTCMonth() + 1).padStart(2, '0')}-${String(nextWeekAfterArchive.getUTCDate()).padStart(2, '0')}`;
        
        const calendarDate = new Date(currentCalendarWeek + 'T00:00:00Z');
        const nextWeekDate = new Date(nextWeekStart + 'T00:00:00Z');
        
        let activeWeekStart: string;
        let source: string;
        
        // IMPORTANT: Only advance one week at a time after an archive
        // This prevents skipping weeks if archive was missed
        if (calendarDate >= nextWeekDate) {
          // Calendar is at or past the next week after archive
          // Use the next week after archive (not current calendar!) to ensure no weeks are skipped
          // Exception: If calendar is same as next week, that's expected progression
          if (calendarDate.getTime() === nextWeekDate.getTime()) {
            activeWeekStart = currentCalendarWeek;
            source = 'calendar-after-archive';
          } else {
            // Calendar is AHEAD of next week - there's a gap!
            // Stay on the next unarchived week (week after last archive) until it gets archived
            activeWeekStart = nextWeekStart;
            source = 'next-unarchived-week';
            console.log(`[reporting-week] Gap detected! Latest archive: ${latestArchivedWeekStart}, Calendar: ${currentCalendarWeek}, Using: ${nextWeekStart}`);
          }
        } else {
          // Calendar is still in the same week as archive or before
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

  // Unified People API
  // Get all people (for resolving person names in feedback entries)
  app.get('/api/people', isAuthenticated, async (_req, res) => {
    try {
      const allPeople = await storage.getAllPeople();
      res.json(allPeople);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create a person with specified roles
  app.post('/api/people', isAuthenticated, requirePermission('canAddTeamMembers'), async (req, res) => {
    try {
      const { name, email, roles } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      
      // Check if person with this email already exists
      if (email) {
        const existingPerson = await storage.getPersonByEmail(email);
        if (existingPerson) {
          // Person exists - add any new roles
          let updated = existingPerson;
          for (const role of (roles || [])) {
            updated = await storage.addRoleToPerson(existingPerson.id, role) || updated;
          }
          // Update name if different
          if (name && name !== existingPerson.name) {
            updated = await storage.updatePerson(existingPerson.id, { name }) || updated;
          }
          return res.json(updated);
        }
      }
      
      // Create new person with specified roles
      const person = await storage.createPerson({
        name,
        email: email || null,
        roles: roles || [],
      });
      res.json(person);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update a person
  app.patch('/api/people/:id', isAuthenticated, requirePermission('canEditTeamMembers'), async (req, res) => {
    try {
      const { name, email, roles } = req.body;
      const person = await storage.getPersonById(req.params.id);
      if (!person) {
        return res.status(404).json({ error: 'Person not found' });
      }
      
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (roles !== undefined) updates.roles = roles;
      
      const updated = await storage.updatePerson(req.params.id, updates);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Add role to person
  app.post('/api/people/:id/roles', isAuthenticated, requirePermission('canEditTeamMembers'), async (req, res) => {
    try {
      const { role } = req.body;
      if (!role) {
        return res.status(400).json({ error: 'Role is required' });
      }
      const updated = await storage.addRoleToPerson(req.params.id, role);
      if (!updated) {
        return res.status(404).json({ error: 'Person not found' });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Remove role from person
  app.delete('/api/people/:id/roles/:role', isAuthenticated, requirePermission('canDeletePeople'), async (req, res) => {
    try {
      const person = await storage.getPersonById(req.params.id);
      if (!person) {
        return res.status(404).json({ error: 'Person not found' });
      }
      
      const updated = await storage.removeRoleFromPerson(req.params.id, req.params.role);
      
      // If person has no roles left, delete them entirely
      if (updated && updated.roles.length === 0) {
        await storage.deletePerson(req.params.id);
        return res.json({ deleted: true });
      }
      
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Merge duplicate people by email (admin only) - also updates all project references
  app.post('/api/people/merge-duplicates', isAuthenticated, requirePermission('canManageUsers'), async (req, res) => {
    try {
      const result = await storage.mergeDuplicatePeople();
      res.json({ 
        message: `Merged ${result.mergedCount} duplicate entries, updated ${result.projectsUpdated} projects`, 
        mergedCount: result.mergedCount,
        projectsUpdated: result.projectsUpdated,
        details: result.details
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Cleanup orphaned references in projects (admin only)
  app.post('/api/projects/cleanup-orphaned', isAuthenticated, requirePermission('canManageUsers'), async (req, res) => {
    try {
      const result = await storage.cleanupOrphanedReferences();
      res.json({ 
        message: `Cleaned up ${result.projectsUpdated} projects: removed ${result.orphanedLeadsRemoved} orphaned lead references and ${result.orphanedMembersRemoved} orphaned member references`, 
        projectsUpdated: result.projectsUpdated,
        orphanedLeadsRemoved: result.orphanedLeadsRemoved,
        orphanedMembersRemoved: result.orphanedMembersRemoved
      });
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
      
      // Check if person with this email already exists
      if (data.email) {
        const existingPerson = await storage.getPersonByEmail(data.email);
        if (existingPerson) {
          // Person exists - add team-member role if not already present
          const updated = await storage.addRoleToPerson(existingPerson.id, 'team-member');
          // Update name if provided and different
          if (data.name && data.name !== existingPerson.name) {
            await storage.updatePerson(existingPerson.id, { name: data.name });
          }
          return res.json(updated);
        }
      }
      
      // No existing person - create new one
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
      const person = await storage.getPersonById(req.params.id);
      if (!person) {
        return res.status(404).json({ error: 'Team member not found' });
      }
      
      // Remove team-member role instead of deleting person entirely
      const updated = await storage.removeRoleFromPerson(req.params.id, 'team-member');
      
      // If person has no roles left, delete them entirely
      if (updated && updated.roles.length === 0) {
        await storage.deletePerson(req.params.id);
        return res.json({ success: true, deleted: true });
      }
      
      res.json({ success: true, roleRemoved: true });
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
      
      // Check if person with this email already exists
      if (data.email) {
        const existingPerson = await storage.getPersonByEmail(data.email);
        if (existingPerson) {
          // Person exists - add project-lead role if not already present
          const updated = await storage.addRoleToPerson(existingPerson.id, 'project-lead');
          // Update name if provided and different
          if (data.name && data.name !== existingPerson.name) {
            await storage.updatePerson(existingPerson.id, { name: data.name });
          }
          return res.json(updated);
        }
      }
      
      // No existing person - create new one
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
      const person = await storage.getPersonById(req.params.id);
      if (!person) {
        return res.status(404).json({ error: 'Project lead not found' });
      }
      
      // Remove project-lead role instead of deleting person entirely
      const updated = await storage.removeRoleFromPerson(req.params.id, 'project-lead');
      
      // If person has no roles left, delete them entirely
      if (updated && updated.roles.length === 0) {
        await storage.deletePerson(req.params.id);
        return res.json({ success: true, deleted: true });
      }
      
      res.json({ success: true, roleRemoved: true });
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

  // Get all people with feedback (for Member Feedback section)
  // Admins/managers see all feedback; leads/members only see feedback they submitted
  app.get('/api/people/feedback', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      // Admins and managers can view all feedback
      const canViewAll = user.role === 'admin' || user.role === 'manager';
      
      if (canViewAll) {
        // Return all people with feedback
        const allPeople = await storage.getAllPeople();
        const peopleWithFeedback = allPeople.filter(p => p.feedback && p.feedback.trim());
        res.json(peopleWithFeedback);
      } else {
        // Leads and members can only see people they submitted feedback about
        const userEmail = user.email || '';
        const feedbackEntries = await storage.getFeedbackEntriesBySubmitter(userEmail);
        const personIds = new Set(feedbackEntries.map(e => e.aboutPersonId));
        
        const allPeople = await storage.getAllPeople();
        const peopleWithUserFeedback = allPeople.filter(p => personIds.has(p.id));
        res.json(peopleWithUserFeedback);
      }
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

  // Delete individual feedback entry (admin/manager only)
  app.delete('/api/feedback-entries/:id', isAuthenticated, requirePermission('canDeleteTeamFeedback'), async (req, res) => {
    try {
      // Get the feedback entry first to know which person it's about
      const entry = await storage.getFeedbackEntryById(req.params.id);
      if (!entry) {
        return res.status(404).json({ error: 'Feedback entry not found' });
      }
      
      const personId = entry.aboutPersonId;
      
      // Delete the feedback entry
      const success = await storage.deleteFeedbackEntry(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Feedback entry not found' });
      }
      
      // Recalculate the aggregated feedback for the person from remaining entries
      const remainingEntries = await storage.getFeedbackEntriesAboutPerson(personId);
      const aggregatedFeedback = remainingEntries.map(e => e.feedback).join('\n\n');
      
      // Update the person's aggregated feedback field
      await storage.updatePersonFeedback(personId, aggregatedFeedback || '');
      
      res.json({ success: true });
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

  app.post('/api/weekly-reports', isAuthenticated, requirePermission('canEditReports'), async (req, res) => {
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

      // Fetch previous week's archived report for week-over-week comparison
      const savedReports = await storage.getSavedReports();
      // Find the most recent account-type archived report before current week
      const previousWeekReport = savedReports
        .filter(r => r.reportType === 'account' && r.weekStart < currentWeekStart)
        .sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];
      
      // Build previous week context if available
      let lastWeekContext = null;
      if (previousWeekReport && previousWeekReport.aiSummary) {
        const lastWeekSummary = previousWeekReport.aiSummary as any;
        lastWeekContext = {
          weekStart: previousWeekReport.weekStart,
          weekEnd: previousWeekReport.weekEnd,
          overallHealth: lastWeekSummary.overallHealth || 'unknown',
          portfolioHealthBreakdown: lastWeekSummary.portfolioHealthBreakdown || null,
          executiveSummary: lastWeekSummary.executiveSummary || null,
          keyAchievements: lastWeekSummary.keyAchievements || [],
          crossProjectPatterns: lastWeekSummary.crossProjectPatterns || null
        };
      }

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

      // Build the last week data section for the prompt
      const lastWeekSection = lastWeekContext 
        ? `
LAST WEEK'S DATA (for week-over-week comparison):
${JSON.stringify(lastWeekContext, null, 2)}
`
        : `
LAST WEEK'S DATA: Not available (this is the first week or no prior archive exists).
`;

      const leadershipPrompt = `You are a senior executive assistant synthesizing weekly project reports for C-level leadership.
You are analyzing ${submittedReports.length} project reports across the portfolio.
Your goal is to provide a COMPREHENSIVE, DECISION-READY executive summary that eliminates the need for leadership to read individual reports.

REPORT DATA TO ANALYZE:
${JSON.stringify(leadershipContext, null, 2)}
${lastWeekSection}

INSTRUCTIONS:

General Requirements:
- Be thorough and explicit — name projects, customers, and leads throughout.
- Do not omit or downplay significant details — include ALL meaningful insights.
- Do not infer or invent missing information. If something is not in the reports, state "not provided".
- Prioritize insights by business impact, not by project order.
- Group related insights for readability and portfolio-level clarity.
- Return valid JSON ONLY, with no commentary before or after the JSON.

Project Health Classification Rules (use these definitions strictly):
- on-track → Progressing as planned, no major risks or blockers, milestones on schedule.
- needs-attention → Emerging risks, moderate delays, resource constraints, or minor blockers that require monitoring.
- critical → Major blockers, severe delays, missed milestones, customer escalations, or high probability of failure without intervention.
- All projects must be assigned to exactly one category.

Week-over-Week Change Analysis:
For each project, consider and highlight:
- What improved this week
- What worsened or escalated
- Any new risks identified
- Any issues resolved
- If prior-week data is unavailable, state "change data not provided".

Conciseness Requirements:
- Each project entry should be 1–2 sentences maximum unless critical.
- Cross-project patterns should include 3–5 bullets max.
- Executive summary should be 4–5 sentences.

Naming and Formatting Consistency:
Use consistent formatting for lists: "Project Name (Customer) – Lead Name: reason or insight"

JSON STRUCTURE TO GENERATE:
{
  "overallHealth": "on-track" | "needs-attention" | "critical",

  "executiveSummary": "A comprehensive 4–5 sentence synthesis of overall portfolio health, major themes, critical concerns, positive trends, and week-over-week shifts. Explicitly reference notable numbers, trends, and emerging risks.",

  "weekOverWeekChanges": {
    "improved": ["High-level improvements across projects with context"],
    "worsened": ["Issues that escalated or worsened compared to last week"],
    "newRisks": ["Newly identified risks or concerns"],
    "resolved": ["Issues closed or mitigated this week"]
  },

  "portfolioHealthBreakdown": {
    "onTrack": { "count": number, "projects": ["Project A (Customer) – Lead Name"] },
    "needsAttention": { "count": number, "projects": ["Project B (Customer) – Lead Name: brief reason"] },
    "critical": { "count": number, "projects": ["Project C (Customer) – Lead Name: brief reason"] }
  },

  "immediateAttentionRequired": [
    { "project": "Project Name", "customer": "Customer Name", "lead": "Lead Name", "issue": "Specific blocker or risk requiring leadership involvement", "recommendedAction": "Clear, actionable recommendation for leadership" }
  ],

  "keyAchievements": [
    { "project": "Project Name", "achievement": "Specific milestone or success", "impact": "Business impact or significance" }
  ],

  "crossProjectPatterns": {
    "commonChallenges": ["Challenge 1 affecting multiple projects", "Challenge 2"],
    "resourceConstraints": ["Staffing or capacity issues observed across teams"],
    "processIssues": ["Recurring workflow or process problems across projects"]
  },

  "dependenciesAndCrossTeamNeeds": [
    { "project": "Project Name", "dependency": "Upstream/downstream dependency", "impact": "How it affects timeline or risk", "requiredSupport": "Specific support needed from other teams or leadership" }
  ],

  "upcomingFocus": [
    { "project": "Project Name", "focus": "What the team will focus on next week", "priority": "high" | "medium" | "normal" }
  ],

  "recommendedLeadershipActions": [
    { "action": "Specific action leadership should take", "priority": "high" | "medium", "rationale": "Why this matters and the expected impact" }
  ],

  "weekHighlights": ["Key highlight 1 with context", "Key highlight 2 with context"]
}

FINAL REMINDERS:
- Include ALL PROJECTS in the portfolioHealthBreakdown.
- Include every project with critical status OR major blockers in immediateAttentionRequired.
- Do not invent data — explicitly write "not provided" where needed.
- Output valid JSON only.`;

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
    { "concern": "Specific concern identified", "affectedMembers": ["Name 1", "Name 2"] or "general", "project": "Project Name or 'Multiple'", "severity": "high" | "medium" | "normal" }
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

  // Regenerate AI summary for an archived report
  app.post('/api/saved-reports/:id/regenerate-summary', isAuthenticated, requirePermission('canGenerateAISummary'), async (req, res) => {
    try {
      const report = await storage.getSavedReport(req.params.id);
      if (!report) {
        return res.status(404).json({ error: 'Saved report not found' });
      }

      // Parse CSV data to extract report details
      const csvData = report.csvData;
      if (!csvData) {
        return res.status(400).json({ error: 'No CSV data available to analyze' });
      }

      console.log(`[Regenerate AI] Starting regeneration for ${report.reportType} report, week ${report.weekStart}`);

      if (report.reportType === 'account') {
        // Parse account CSV to extract leadership report data
        // CSV format: Project, Lead, Week Start, Health Status, Progress, Challenges, Next Week, Team Feedback, Submitted
        // State machine approach: preserve raw lines, only normalize after parsing
        const lines = csvData.split('\n');
        const reportContext: Array<{
          project: string;
          customer: string;
          lead: string;
          healthStatus: string;
          progress: string;
          challenges: string;
          nextWeek: string;
        }> = [];

        // State machine: track current section
        let inReportsSection = false;
        let passedHeader = false;

        // Helper to normalize a parsed value (remove quotes, trim whitespace)
        const normalize = (val: string | undefined): string => {
          if (!val) return '';
          return val.replace(/^"|"$/g, '').replace(/""/g, '"').trim();
        };

        for (let i = 0; i < lines.length; i++) {
          const rawLine = lines[i];
          const trimmedForCheck = rawLine.trim(); // Only for section/blank detection
          
          // Check for section headers (use trimmed for comparison only)
          if (trimmedForCheck.includes('=== WEEKLY REPORTS ===')) {
            inReportsSection = true;
            passedHeader = false;
            continue;
          }
          
          // Stop at next section
          if (inReportsSection && trimmedForCheck.startsWith('===')) {
            break;
          }
          
          // Skip blank/empty lines
          if (!trimmedForCheck) {
            continue;
          }
          
          if (!inReportsSection) {
            continue;
          }
          
          // Parse CSV line using raw line (parseCSVLine handles quotes properly)
          const values = parseCSVLine(rawLine);
          
          // Skip header row - check for Project header
          const firstVal = normalize(values[0]);
          if (firstVal === 'Project') {
            passedHeader = true;
            continue;
          }
          
          // Need at least 7 columns for valid data row (and must have passed header)
          if (values.length >= 7 && firstVal && passedHeader) {
            reportContext.push({
              project: normalize(values[0]),
              lead: normalize(values[1]),
              customer: 'Not available', // Customer data not in CSV
              healthStatus: normalize(values[3]),
              progress: normalize(values[4]),
              challenges: normalize(values[5]),
              nextWeek: normalize(values[6])
            });
          }
        }

        if (reportContext.length === 0) {
          console.log(`[Regenerate AI] Failed to parse report data. CSV preview: ${csvData.substring(0, 500)}`);
          return res.status(400).json({ error: 'Could not parse report data from CSV. The CSV may not contain valid report rows or the WEEKLY REPORTS section is missing.' });
        }

        console.log(`[Regenerate AI] Parsed ${reportContext.length} reports from CSV`);

        // Generate leadership AI summary
        const leadershipPrompt = `You are a senior executive assistant synthesizing weekly project reports for C-level leadership.
You are analyzing ${reportContext.length} project reports across the portfolio.
Your goal is to provide a COMPREHENSIVE, DECISION-READY executive summary that eliminates the need for leadership to read individual reports.

REPORT DATA TO ANALYZE:
${JSON.stringify(reportContext, null, 2)}

LAST WEEK'S DATA: Not available (regenerating from archived data).

INSTRUCTIONS:

General Requirements:
- Be thorough and explicit — name projects, customers, and leads throughout.
- Do not omit or downplay significant details — include ALL meaningful insights.
- Do not infer or invent missing information. If something is not in the reports, state "not provided".
- Prioritize insights by business impact, not by project order.
- Group related insights for readability and portfolio-level clarity.
- Return valid JSON ONLY, with no commentary before or after the JSON.

Project Health Classification Rules (use these definitions strictly):
- on-track → Progressing as planned, no major risks or blockers, milestones on schedule.
- needs-attention → Emerging risks, moderate delays, resource constraints, or minor blockers that require monitoring.
- critical → Major blockers, severe delays, missed milestones, customer escalations, or high probability of failure without intervention.
- All projects must be assigned to exactly one category.

JSON STRUCTURE TO GENERATE:
{
  "overallHealth": "on-track" | "needs-attention" | "critical",
  "executiveSummary": "A comprehensive 4–5 sentence synthesis of overall portfolio health, major themes, critical concerns, positive trends.",
  "weekOverWeekChanges": {
    "improved": ["Not available - regenerated from archive"],
    "worsened": ["Not available - regenerated from archive"],
    "newRisks": ["Not available - regenerated from archive"],
    "resolved": ["Not available - regenerated from archive"]
  },
  "portfolioHealthBreakdown": {
    "onTrack": { "count": number, "projects": ["Project A – Lead Name"] },
    "needsAttention": { "count": number, "projects": ["Project B – Lead Name: brief reason"] },
    "critical": { "count": number, "projects": ["Project C – Lead Name: brief reason"] }
  },
  "immediateAttentionRequired": [
    { "project": "Project Name", "customer": "Customer Name", "lead": "Lead Name", "issue": "Specific blocker or risk", "recommendedAction": "Clear recommendation" }
  ],
  "keyAchievements": [
    { "project": "Project Name", "achievement": "Specific milestone or success", "impact": "Business impact" }
  ],
  "crossProjectPatterns": {
    "commonChallenges": ["Challenge 1 affecting multiple projects"],
    "resourceConstraints": ["Staffing or capacity issues"],
    "processIssues": ["Recurring workflow problems"]
  },
  "dependenciesAndCrossTeamNeeds": [],
  "upcomingFocus": [
    { "project": "Project Name", "focus": "What the team will focus on next week", "priority": "high" | "medium" | "normal" }
  ],
  "recommendedLeadershipActions": [
    { "action": "Specific action leadership should take", "priority": "high" | "medium", "rationale": "Why this matters" }
  ],
  "weekHighlights": ["Key highlight 1 with context", "Key highlight 2 with context"]
}

Output valid JSON only.`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: leadershipPrompt }],
          response_format: { type: "json_object" },
          max_completion_tokens: 4096,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No response from AI');
        }

        const aiSummary = JSON.parse(content);
        const updated = await storage.updateSavedReportAiSummary(report.id, aiSummary);
        
        console.log(`[Regenerate AI] Successfully regenerated leadership summary`);
        res.json({ success: true, aiSummary, report: updated });

      } else if (report.reportType === 'team') {
        // Parse team feedback CSV
        // CSV format: Team Member, Role, Projects, Feedback
        // State machine approach: preserve raw lines, only normalize after parsing
        const lines = csvData.split('\n');
        const feedbackContext: Array<{
          personName: string;
          role: string;
          projects: string[];
          feedback: string;
        }> = [];

        // State machine: track whether we've passed the header
        let passedHeader = false;

        // Helper to normalize a parsed value (remove quotes, trim whitespace)
        const normalize = (val: string | undefined): string => {
          if (!val) return '';
          return val.replace(/^"|"$/g, '').replace(/""/g, '"').trim();
        };

        for (let i = 0; i < lines.length; i++) {
          const rawLine = lines[i];
          const trimmedForCheck = rawLine.trim(); // Only for section/blank detection
          
          // Skip blank/empty lines
          if (!trimmedForCheck) {
            continue;
          }
          
          // Stop at section delimiter
          if (trimmedForCheck.startsWith('===')) {
            if (passedHeader) {
              break; // Already found data, stop at next section
            }
            continue; // Skip section headers before data
          }
          
          // Parse CSV line using raw line (parseCSVLine handles quotes properly)
          const values = parseCSVLine(rawLine);
          
          // Check for header row (handles both quoted and unquoted)
          const firstVal = normalize(values[0]);
          if (firstVal === 'Team Member') {
            passedHeader = true;
            continue;
          }
          
          // Validate we have at least 4 columns and a valid person name (and must have passed header)
          if (values.length >= 4 && firstVal && passedHeader) {
            feedbackContext.push({
              personName: normalize(values[0]),
              role: normalize(values[1]) || 'Team Member',
              projects: normalize(values[2]).split(';').map(p => p.trim()).filter(Boolean),
              feedback: normalize(values[3])
            });
          }
        }

        if (feedbackContext.length === 0) {
          console.log(`[Regenerate AI] Failed to parse feedback data. CSV preview: ${csvData.substring(0, 500)}`);
          return res.status(400).json({ error: 'Could not parse feedback data from CSV. The CSV may not contain valid feedback rows or no header row was found.' });
        }

        console.log(`[Regenerate AI] Parsed ${feedbackContext.length} feedback entries from CSV`);

        const teamPrompt = `You are a senior HR analyst synthesizing anonymous feedback about team members and leads.

ANONYMOUS FEEDBACK DATA:
${JSON.stringify(feedbackContext, null, 2)}

Generate a comprehensive team insights summary in JSON format:
{
  "overallTeamMorale": "positive" | "mixed" | "concerning",
  "teamSummary": "A comprehensive 4-5 sentence synthesis of team sentiment, key themes, notable achievements, and areas requiring attention.",
  "teamHighlights": [
    { "memberName": "Name", "project": "Project Name", "highlight": "Specific positive observation" }
  ],
  "recognitionOpportunities": [
    { "memberName": "Name", "project": "Project Name", "achievement": "What they did", "suggestedRecognition": "How to recognize" }
  ],
  "teamConcerns": [
    { "concern": "Specific concern", "affectedMembers": ["Name 1"], "project": "Project Name", "severity": "high" | "medium" | "normal" }
  ],
  "workloadObservations": [],
  "supportNeeded": [
    { "area": "Area where support is needed", "members": ["Names"], "suggestedSupport": "Specific support recommendation" }
  ],
  "developmentOpportunities": [],
  "retentionRisks": [],
  "recommendedHRActions": [
    { "action": "Specific action for leadership", "priority": "high" | "medium", "rationale": "Why this matters" }
  ]
}

Output valid JSON only.`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: teamPrompt }],
          response_format: { type: "json_object" },
          max_completion_tokens: 4096,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No response from AI');
        }

        const aiSummary = JSON.parse(content);
        const updated = await storage.updateSavedReportAiSummary(report.id, aiSummary);
        
        console.log(`[Regenerate AI] Successfully regenerated team summary`);
        res.json({ success: true, aiSummary, report: updated });

      } else {
        return res.status(400).json({ error: 'Unknown report type' });
      }

    } catch (error: any) {
      console.error('[Regenerate AI] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to regenerate AI summary' });
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

  // ====== TASK MANAGEMENT ROUTES ======

  // Get all tasks
  app.get('/api/tasks', isAuthenticated, async (req, res) => {
    try {
      const tasks = await storage.getTasks();
      res.json(tasks);
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ message: 'Failed to fetch tasks' });
    }
  });

  // Get task by ID
  app.get('/api/tasks/:id', isAuthenticated, async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }
      res.json(task);
    } catch (error: any) {
      console.error('Error fetching task:', error);
      res.status(500).json({ message: 'Failed to fetch task' });
    }
  });

  // Get tasks by creator (for "Create Tasks" section)
  app.get('/api/tasks/creator/:email', isAuthenticated, async (req, res) => {
    try {
      const tasks = await storage.getTasksByCreator(req.params.email);
      res.json(tasks);
    } catch (error: any) {
      console.error('Error fetching tasks by creator:', error);
      res.status(500).json({ message: 'Failed to fetch tasks' });
    }
  });

  // Get tasks by assignee (for "Tasks for You" tab)
  app.get('/api/tasks/assignee/:personId', isAuthenticated, async (req, res) => {
    try {
      const tasks = await storage.getTasksByAssignee(req.params.personId);
      res.json(tasks);
    } catch (error: any) {
      console.error('Error fetching tasks by assignee:', error);
      res.status(500).json({ message: 'Failed to fetch tasks' });
    }
  });

  // Get tasks by project (for "All Tasks in SSCMA" tree view)
  app.get('/api/tasks/project/:projectId', isAuthenticated, async (req, res) => {
    try {
      const tasks = await storage.getTasksByProject(req.params.projectId);
      res.json(tasks);
    } catch (error: any) {
      console.error('Error fetching tasks by project:', error);
      res.status(500).json({ message: 'Failed to fetch tasks' });
    }
  });

  // Get sub-tasks
  app.get('/api/tasks/:id/subtasks', isAuthenticated, async (req, res) => {
    try {
      const subtasks = await storage.getSubTasks(req.params.id);
      res.json(subtasks);
    } catch (error: any) {
      console.error('Error fetching subtasks:', error);
      res.status(500).json({ message: 'Failed to fetch subtasks' });
    }
  });

  // Create task
  app.post('/api/tasks/parse-natural-language', isAuthenticated, async (req: any, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ message: 'Text is required' });
      }

      const [allPeople, allProjects] = await Promise.all([
        storage.getPeople(),
        storage.getProjects(),
      ]);

      const peopleList = allPeople.map(p => ({ id: p.id, name: p.name }));
      const projectList = allProjects.map(p => ({ id: p.id, name: p.name, customer: p.customer }));

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a task parser. Extract structured task data from natural language input.

Today's date is ${todayStr} (${today.toLocaleDateString('en-US', { weekday: 'long' })}).

Available people (use exact IDs):
${JSON.stringify(peopleList)}

Available projects/accounts (use exact IDs):
${JSON.stringify(projectList)}

Return a JSON object with these fields:
- "title": string - a clean, concise task title (action-oriented, remove assignee/project/date references)
- "assigneeIds": string[] - array of matched person IDs (match by first name, last name, or full name)
- "assigneeNames": string[] - the matched person names (for display)
- "projectId": string|null - matched project ID (match by project name or customer name)
- "projectName": string|null - the matched project name (for display)
- "dueDate": string|null - ISO date string (YYYY-MM-DD). Parse "tomorrow", "next Monday", "March 30th", "by end of week", etc.
- "priority": "normal"|"medium"|"high" - infer from urgency words like "urgent", "ASAP", "critical" = high; "important" = medium; default = normal
- "status": "todo" - always default to todo
- "confidence": number - 0 to 1, how confident you are in the overall parsing

Be flexible with name matching - "Hanish" should match a person whose name contains "Hanish". Match projects by any part of their name or customer name (e.g., "Exxon CM" should match a project with "Exxon" in the name and customer).

If you cannot match a person or project, set the ID to null but still include the name the user mentioned in a separate field:
- "unmatchedPeople": string[] - names mentioned but not found in the people list
- "unmatchedProjects": string[] - project/account names mentioned but not found`
          },
          {
            role: "user",
            content: text
          }
        ]
      });

      const raw = JSON.parse(completion.choices[0].message.content || '{}');
      const validStatuses = ['todo', 'in-progress', 'blocked', 'done', 'cancelled'];
      const validPriorities = ['normal', 'medium', 'high'];
      const sanitized = {
        title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : 'Untitled Task',
        assigneeIds: Array.isArray(raw.assigneeIds) ? raw.assigneeIds.filter((id: any) => typeof id === 'string' && id) : [],
        assigneeNames: Array.isArray(raw.assigneeNames) ? raw.assigneeNames.filter((n: any) => typeof n === 'string') : [],
        projectId: typeof raw.projectId === 'string' && raw.projectId ? raw.projectId : null,
        projectName: typeof raw.projectName === 'string' ? raw.projectName : null,
        dueDate: typeof raw.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw.dueDate) ? raw.dueDate.slice(0, 10) : null,
        priority: validPriorities.includes(raw.priority) ? raw.priority : 'normal',
        status: validStatuses.includes(raw.status) ? raw.status : 'todo',
        confidence: typeof raw.confidence === 'number' ? Math.min(1, Math.max(0, raw.confidence)) : 0.5,
        unmatchedPeople: Array.isArray(raw.unmatchedPeople) ? raw.unmatchedPeople : [],
        unmatchedProjects: Array.isArray(raw.unmatchedProjects) ? raw.unmatchedProjects : [],
      };
      res.json(sanitized);
    } catch (error: any) {
      console.error('Error parsing natural language task:', error);
      res.status(500).json({ message: 'Failed to parse task' });
    }
  });

  app.post('/api/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const userEmail = req.user.claims.email;
      const taskData = {
        ...req.body,
        createdBy: userEmail,
      };
      
      const parsed = insertTaskSchema.safeParse(taskData);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid task data', errors: parsed.error.errors });
      }
      
      const task = await storage.createTask(parsed.data);
      
      // Log task creation activity
      await storage.createTaskActivity({
        taskId: task.id,
        changedBy: userEmail,
        changeType: 'created',
        previousValue: null,
        newValue: { title: task.title, status: task.status, priority: task.priority },
      });
      
      res.status(201).json(task);
    } catch (error: any) {
      console.error('Error creating task:', error);
      res.status(500).json({ message: 'Failed to create task' });
    }
  });

  // Update task
  app.patch('/api/tasks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userEmail = req.user?.claims?.email as string;
      const taskId = req.params.id;
      
      // Get the existing task to detect changes
      const existingTask = await storage.getTask(taskId);
      if (!existingTask) {
        return res.status(404).json({ message: 'Task not found' });
      }
      
      const updates = { ...req.body, updatedBy: userEmail };
      const task = await storage.updateTask(taskId, updates);
      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }
      
      // Log activity for each type of change
      const activityPromises: Promise<any>[] = [];
      
      // Status change
      if (updates.status !== undefined && updates.status !== existingTask.status) {
        activityPromises.push(storage.createTaskActivity({
          taskId,
          changedBy: userEmail,
          changeType: 'status_change',
          previousValue: { status: existingTask.status },
          newValue: { status: updates.status },
        }));
      }
      
      // Priority change
      if (updates.priority !== undefined && updates.priority !== existingTask.priority) {
        activityPromises.push(storage.createTaskActivity({
          taskId,
          changedBy: userEmail,
          changeType: 'priority_change',
          previousValue: { priority: existingTask.priority },
          newValue: { priority: updates.priority },
        }));
      }
      
      // Title change
      if (updates.title !== undefined && updates.title !== existingTask.title) {
        activityPromises.push(storage.createTaskActivity({
          taskId,
          changedBy: userEmail,
          changeType: 'title_edit',
          previousValue: { title: existingTask.title },
          newValue: { title: updates.title },
        }));
      }
      
      // Due date change
      if (updates.dueDate !== undefined && updates.dueDate !== existingTask.dueDate) {
        activityPromises.push(storage.createTaskActivity({
          taskId,
          changedBy: userEmail,
          changeType: 'due_date_change',
          previousValue: { dueDate: existingTask.dueDate },
          newValue: { dueDate: updates.dueDate },
        }));
      }
      
      // Notes added (compare array lengths - new notes are appended)
      const existingNotes = (existingTask.notes as any[]) || [];
      const updatedNotes = (updates.notes as any[]) || [];
      if (updatedNotes.length > existingNotes.length) {
        // New notes were added
        const newNotes = updatedNotes.slice(existingNotes.length);
        for (const note of newNotes) {
          activityPromises.push(storage.createTaskActivity({
            taskId,
            changedBy: userEmail,
            changeType: 'note_added',
            previousValue: null,
            newValue: { content: note.content, author: note.author },
          }));
        }
      }
      
      // Assignee changes
      const existingAssignees = existingTask.assignedTo || [];
      const updatedAssignees = updates.assignedTo || [];
      if (updates.assignedTo !== undefined) {
        const added = updatedAssignees.filter((id: string) => !existingAssignees.includes(id));
        const removed = existingAssignees.filter((id: string) => !updatedAssignees.includes(id));
        
        for (const assigneeId of added) {
          activityPromises.push(storage.createTaskActivity({
            taskId,
            changedBy: userEmail,
            changeType: 'assignee_added',
            previousValue: null,
            newValue: { assigneeId },
          }));
        }
        
        for (const assigneeId of removed) {
          activityPromises.push(storage.createTaskActivity({
            taskId,
            changedBy: userEmail,
            changeType: 'assignee_removed',
            previousValue: { assigneeId },
            newValue: null,
          }));
        }
      }
      
      // Execute all activity logging in parallel
      await Promise.all(activityPromises);
      
      res.json(task);
    } catch (error: any) {
      console.error('Error updating task:', error);
      res.status(500).json({ message: 'Failed to update task' });
    }
  });

  // Delete task
  app.delete('/api/tasks/:id', isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteTask(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Task not found' });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting task:', error);
      res.status(500).json({ message: 'Failed to delete task' });
    }
  });

  // ====== TASK ACTIVITY ROUTES ======

  // Get task activities with optional filters
  app.get('/api/task-activity', isAuthenticated, async (req: any, res) => {
    try {
      const { taskId, changedBy, startDate, endDate } = req.query;
      
      let activities: any[] = [];
      
      if (taskId) {
        // Get activities for a specific task
        activities = await storage.getTaskActivities(taskId as string);
      } else if (changedBy) {
        // Get activities by user with optional date range
        const start = startDate ? new Date(startDate as string) : undefined;
        const end = endDate ? new Date(endDate as string) : undefined;
        activities = await storage.getActivitiesByUser(changedBy as string, start, end);
      }
      
      res.json(activities);
    } catch (error: any) {
      console.error('Error fetching task activities:', error);
      res.status(500).json({ message: 'Failed to fetch task activities' });
    }
  });

  // ====== EOD REPORT ROUTES ======

  // Generate EOD (End of Day) report with AI summary
  app.get('/api/eod-report', isAuthenticated, async (req: any, res) => {
    try {
      const userEmail = req.user.claims.email;
      const { startUtc, endUtc } = req.query;

      if (!startUtc || !endUtc) {
        return res.status(400).json({ message: 'startUtc and endUtc query parameters are required' });
      }

      const startDate = new Date(startUtc as string);
      const endDate = new Date(endUtc as string);

      // Validate dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ message: 'Invalid date format. Use ISO 8601 format.' });
      }

      // Get activities for the user within the date range
      const activities = await storage.getActivitiesByUser(userEmail, startDate, endDate);

      if (activities.length === 0) {
        return res.json({
          startDate: startUtc,
          endDate: endUtc,
          user: userEmail,
          summary: '',
          activityCount: 0,
          accountsWorked: [],
          rawActivities: []
        });
      }

      // Get all tasks and projects for context
      const allTasks = await storage.getTasks();
      const allProjects = await storage.getProjects();

      // Create lookup maps
      const taskMap = new Map(allTasks.map(t => [t.id, t]));
      const projectMap = new Map(allProjects.map(p => [p.id, p]));

      // Group activities by account/project
      const accountActivities: Record<string, { 
        accountName: string; 
        activities: Array<{
          taskTitle: string;
          changeType: string;
          previousValue: any;
          newValue: any;
          timestamp: Date;
        }> 
      }> = {};

      for (const activity of activities) {
        const task = taskMap.get(activity.taskId);
        const taskTitle = task?.title || 'Unknown Task';
        const projectId = task?.projectId;
        const project = projectId ? projectMap.get(projectId) : null;
        const accountHeader = project?.steadyKey || project?.name?.replace(/\s+/g, '_') || 'No_Account';
        const accountKey = project?.id || 'no-account';

        if (!accountActivities[accountKey]) {
          accountActivities[accountKey] = {
            accountName: accountHeader,
            activities: []
          };
        }

        accountActivities[accountKey].activities.push({
          taskTitle,
          changeType: activity.changeType,
          previousValue: activity.previousValue,
          newValue: activity.newValue,
          timestamp: activity.changedAt
        });
      }

      // Step 1: Group activities by task within each account
      const formattedActivities = Object.values(accountActivities).map(account => {
        // Group activities by task within this account
        const taskGroups: Record<string, {
          taskTitle: string;
          notes: string[];
          statusChanges: string[];
          otherChanges: string[];
        }> = {};

        for (const a of account.activities) {
          const taskKey = a.taskTitle;
          if (!taskGroups[taskKey]) {
            taskGroups[taskKey] = {
              taskTitle: a.taskTitle,
              notes: [],
              statusChanges: [],
              otherChanges: []
            };
          }

          switch (a.changeType) {
            case 'created':
              taskGroups[taskKey].otherChanges.push('Created');
              break;
            case 'status_change':
              const prevStatus = (a.previousValue as any)?.status || 'unknown';
              const newStatus = (a.newValue as any)?.status || 'unknown';
              taskGroups[taskKey].statusChanges.push(`${prevStatus} → ${newStatus}`);
              break;
            case 'note_added':
              const noteContent = (a.newValue as any)?.content || '';
              if (noteContent) taskGroups[taskKey].notes.push(noteContent);
              break;
            case 'priority_change':
              const newPriority = (a.newValue as any)?.priority || 'unknown';
              taskGroups[taskKey].otherChanges.push(`Priority set to ${newPriority}`);
              break;
            case 'due_date_change':
              taskGroups[taskKey].otherChanges.push('Due date updated');
              break;
            default:
              break;
          }
        }

        // Step 2: Format each task's combined activities
        const taskSummaries = Object.values(taskGroups).map(task => {
          const parts: string[] = [];
          
          // Add notes (most important - the actual updates)
          if (task.notes.length > 0) {
            parts.push(`Notes: ${task.notes.join(' | ')}`);
          }
          
          // Add status changes to show progression (started, progressed, completed, blocked)
          if (task.statusChanges.length > 0) {
            // Show all transitions to understand the journey
            const transitions = task.statusChanges.map(change => {
              const [from, to] = change.split(' → ');
              if (from === 'todo' && to === 'in-progress') return 'Started';
              if (to === 'done') return 'Completed';
              if (to === 'blocked') return 'Blocked';
              if (from === 'blocked' && to === 'in-progress') return 'Unblocked';
              if (to === 'cancelled') return 'Cancelled';
              return `${from} → ${to}`;
            });
            parts.push(`Progress: ${transitions.join(', ')}`);
          }
          
          // Add other significant changes
          if (task.otherChanges.includes('Created')) {
            parts.push('Newly created');
          }

          return `  - Task: "${task.taskTitle}"\n    ${parts.join('\n    ')}`;
        });

        return `**${account.accountName}**\n${taskSummaries.join('\n')}`;
      }).join('\n\n');

      // Generate AI summary
      const systemPrompt = `You are a senior team member writing a concise End of Day work update.
Your goal is to explain meaningful progress and outcomes, not list actions.
Think like a human reporting to a manager.`;

      const userPrompt = `Generate a professional End of Day update grouped by account/project.

Guidelines:
- Group the update by account/project.
- Within each account, summarize meaningful work in plain language.
- Do NOT list task names or individual actions.
- Combine all activity related to the same task into a single concise line.
- Use note content to infer outcomes, blockers resolved, communication done, or progress made.
- Focus on WHAT was accomplished or progressed, not HOW the system changed.
- Prefer outcomes like:
  - completed
  - progressed
  - unblocked
  - blocked
  - started
  - communicated
- Ignore low-signal actions unless they add context.
- Use past tense for completed work and present tense for ongoing work.

Formatting rules:
- Start with one high-level summary sentence.
- For each account, write ONE line in this exact format: account_key : summary of meaningful work done
  - Use the exact account/project key provided in the data (do NOT modify it - keep underscores, do not add spaces). Do NOT use markdown headers (no ## or **).
  - The summary after the colon should be a concise sentence describing meaningful outcomes.
  - If there are multiple distinct outcomes for one account, separate them with semicolons on the same line.

Activities (grouped by account and task):
${formattedActivities}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-5.2',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 1000,
      });

      const summary = completion.choices[0]?.message?.content || '';

      res.json({
        startDate: startUtc,
        endDate: endUtc,
        user: userEmail,
        summary,
        activityCount: activities.length,
        accountsWorked: Object.values(accountActivities).map(a => a.accountName),
        rawActivities: formattedActivities
      });
    } catch (error: any) {
      console.error('Error generating EOD report:', error);
      res.status(500).json({ message: 'Failed to generate EOD report' });
    }
  });

  // ====== TASK TEMPLATE ROUTES ======

  // Get all task templates
  app.get('/api/task-templates', isAuthenticated, async (req, res) => {
    try {
      const templates = await storage.getTaskTemplates();
      res.json(templates);
    } catch (error: any) {
      console.error('Error fetching task templates:', error);
      res.status(500).json({ message: 'Failed to fetch task templates' });
    }
  });

  // Get task template by ID
  app.get('/api/task-templates/:id', isAuthenticated, async (req, res) => {
    try {
      const template = await storage.getTaskTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: 'Task template not found' });
      }
      res.json(template);
    } catch (error: any) {
      console.error('Error fetching task template:', error);
      res.status(500).json({ message: 'Failed to fetch task template' });
    }
  });

  // Create task template
  app.post('/api/task-templates', isAuthenticated, async (req: any, res) => {
    try {
      const userEmail = req.user.claims.email;
      const templateData = {
        ...req.body,
        createdBy: userEmail,
      };
      
      const parsed = insertTaskTemplateSchema.safeParse(templateData);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid template data', errors: parsed.error.errors });
      }
      
      // Create template first
      const template = await storage.createTaskTemplate(parsed.data);
      
      // Calculate and set next occurrence dates
      const nextOccurrence = calculateNextOccurrence(template);
      if (nextOccurrence) {
        await storage.updateTaskTemplate(template.id, {
          nextTriggerAt: nextOccurrence.nextTriggerAt,
          nextDueAt: nextOccurrence.nextDueAt,
        });
        // Return updated template
        const updatedTemplate = await storage.getTaskTemplate(template.id);
        res.status(201).json(updatedTemplate);
      } else {
        res.status(201).json(template);
      }
    } catch (error: any) {
      console.error('Error creating task template:', error);
      res.status(500).json({ message: 'Failed to create task template' });
    }
  });

  // Update task template
  app.patch('/api/task-templates/:id', isAuthenticated, async (req, res) => {
    try {
      const updates = { ...req.body };
      // Convert lastUsedAt string to Date object for Drizzle timestamp column
      if (updates.lastUsedAt && typeof updates.lastUsedAt === 'string') {
        updates.lastUsedAt = new Date(updates.lastUsedAt);
      }
      
      // Check if schedule-related fields are being updated
      const scheduleFields = ['recurrence', 'startTime', 'endTime', 'startDay', 'endDay', 
                              'startDate', 'endDate', 'daysOfWeek', 'timezone', 
                              'deliveryTime', 'deliveryDay', 'deliveryDate'];
      const needsRecalculation = scheduleFields.some(field => field in updates);
      
      // Check if this is a manual trigger (lastTriggeredAt update)
      const isManualTrigger = 'lastTriggeredAt' in updates;
      console.log('[Template PATCH] isManualTrigger:', isManualTrigger, 'needsRecalculation:', needsRecalculation, 'updates:', Object.keys(updates));
      
      // Apply updates first
      let template = await storage.updateTaskTemplate(req.params.id, updates);
      if (!template) {
        return res.status(404).json({ message: 'Task template not found' });
      }
      
      // Recalculate next occurrence if schedule changed
      if (needsRecalculation) {
        console.log('[Template PATCH] Recalculating due to schedule change');
        
        // Check if template was already triggered today (in template's timezone)
        // If so, use calculateNextOccurrenceAfterTrigger to prevent going back to today
        let useAfterTrigger = false;
        if (template.lastTriggeredAt) {
          const tzMatch = template.timezone?.match(/^([+-]?)(\d{1,2})(?::(\d{2}))?$/);
          const tzOffsetMinutes = tzMatch 
            ? (tzMatch[1] === '-' ? -1 : 1) * (parseInt(tzMatch[2], 10) * 60 + parseInt(tzMatch[3] || '0', 10))
            : 0;
          
          const now = new Date();
          const nowInTzMs = now.getTime() + tzOffsetMinutes * 60 * 1000;
          const nowInTz = new Date(nowInTzMs);
          
          const lastTriggered = new Date(template.lastTriggeredAt);
          const lastTriggeredInTzMs = lastTriggered.getTime() + tzOffsetMinutes * 60 * 1000;
          const lastTriggeredInTz = new Date(lastTriggeredInTzMs);
          
          // Check if last triggered was today in the template's timezone
          useAfterTrigger = nowInTz.getUTCFullYear() === lastTriggeredInTz.getUTCFullYear() &&
                           nowInTz.getUTCMonth() === lastTriggeredInTz.getUTCMonth() &&
                           nowInTz.getUTCDate() === lastTriggeredInTz.getUTCDate();
          
          console.log('[Template PATCH] lastTriggeredAt check - useAfterTrigger:', useAfterTrigger);
        }
        
        const nextOccurrence = useAfterTrigger 
          ? calculateNextOccurrenceAfterTrigger(template)
          : calculateNextOccurrence(template);
          
        if (nextOccurrence) {
          template = await storage.updateTaskTemplate(req.params.id, {
            nextTriggerAt: nextOccurrence.nextTriggerAt,
            nextDueAt: nextOccurrence.nextDueAt,
          });
        }
      }
      
      // If manual trigger, calculate next occurrence after trigger
      if (isManualTrigger && !needsRecalculation && template) {
        console.log('[Template PATCH] Manual trigger - calculating next occurrence');
        const nextOccurrence = calculateNextOccurrenceAfterTrigger(template);
        console.log('[Template PATCH] nextOccurrence result:', nextOccurrence);
        if (nextOccurrence) {
          template = await storage.updateTaskTemplate(req.params.id, {
            nextTriggerAt: nextOccurrence.nextTriggerAt,
            nextDueAt: nextOccurrence.nextDueAt,
          });
          console.log('[Template PATCH] Updated template with new dates');
        }
      }
      
      res.json(template);
    } catch (error: any) {
      console.error('Error updating task template:', error);
      res.status(500).json({ message: 'Failed to update task template' });
    }
  });

  // Delete task template
  app.delete('/api/task-templates/:id', isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteTaskTemplate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Task template not found' });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting task template:', error);
      res.status(500).json({ message: 'Failed to delete task template' });
    }
  });

  // ============================================
  // SCHEDULER ENDPOINTS (for platform-agnostic automation)
  // These can be called by any scheduler: Replit Scheduled Deployments,
  // Linux cron, cloud schedulers, or manual triggers
  // ============================================

  // POST /api/scheduler/recalculate-all
  // Recalculates nextTriggerAt and nextDueAt for all templates
  // Useful after scheduler logic changes
  app.post('/api/scheduler/recalculate-all', async (req, res) => {
    try {
      const templates = await storage.getTaskTemplates();
      const results: { templateId: string; templateName: string; nextTriggerAt: string | null; nextDueAt: string | null }[] = [];
      
      for (const template of templates) {
        if (!template.recurrence) continue;
        
        const nextOccurrence = calculateNextOccurrence(template);
        if (nextOccurrence) {
          await storage.updateTaskTemplate(template.id, {
            nextTriggerAt: nextOccurrence.nextTriggerAt,
            nextDueAt: nextOccurrence.nextDueAt,
          });
          results.push({
            templateId: template.id,
            templateName: template.name,
            nextTriggerAt: nextOccurrence.nextTriggerAt,
            nextDueAt: nextOccurrence.nextDueAt,
          });
        }
      }
      
      console.log(`[Scheduler] Recalculated ${results.length} templates`);
      res.json({ success: true, recalculated: results.length, results });
    } catch (error: any) {
      console.error('[Scheduler] Error recalculating templates:', error);
      res.status(500).json({ message: 'Failed to recalculate templates', error: error.message });
    }
  });

  // POST /api/scheduler/trigger-deliverables
  // Checks all auto-trigger enabled templates and creates tasks for due ones
  app.post('/api/scheduler/trigger-deliverables', async (req, res) => {
    try {
      // Optional: API key authentication for external schedulers
      const authHeader = req.headers['x-scheduler-key'];
      const schedulerKey = process.env.SCHEDULER_API_KEY;
      
      // If SCHEDULER_API_KEY is set, require it. Otherwise allow unauthenticated calls
      if (schedulerKey && authHeader !== schedulerKey) {
        return res.status(401).json({ message: 'Invalid scheduler key' });
      }

      const now = new Date();
      // Use UTC date for comparison to avoid timezone issues
      const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      console.log(`[Scheduler] Trigger deliverables called at ${now.toISOString()}`);

      // Get all templates with auto-trigger enabled
      const allTemplates = await storage.getTaskTemplates();
      const allProjects = await storage.getProjects();
      const projectMap = new Map(allProjects.map(p => [p.id, p]));
      
      const autoTriggerTemplates = allTemplates.filter(t => 
        t.isActive === 'true' && 
        t.autoTriggerEnabled === 'true' &&
        t.recurrence // Must have a recurrence pattern
      );

      // Filter out templates whose linked project has expired
      const activeTemplates: typeof autoTriggerTemplates = [];
      const expiredTemplates: { template: typeof autoTriggerTemplates[0]; projectEndDate: string }[] = [];
      
      for (const template of autoTriggerTemplates) {
        if (template.projectId) {
          const project = projectMap.get(template.projectId);
          if (project?.endDate) {
            // Parse endDate as UTC and compare with UTC today (inclusive - disable after end date)
            const endDateParts = project.endDate.split('-').map(Number);
            const endDateUTC = new Date(Date.UTC(endDateParts[0], endDateParts[1] - 1, endDateParts[2]));
            if (endDateUTC < todayUTC) {
              expiredTemplates.push({ template, projectEndDate: project.endDate });
              continue;
            }
          }
        }
        activeTemplates.push(template);
      }
      
      // Auto-disable templates whose linked projects have expired
      for (const { template, projectEndDate } of expiredTemplates) {
        await storage.updateTaskTemplate(template.id, { 
          isActive: 'false',
          autoTriggerEnabled: 'false'
        });
        console.log(`[Scheduler] Auto-disabled template "${template.name}" - project ended ${projectEndDate}`);
      }

      console.log(`[Scheduler] Found ${activeTemplates.length} active auto-trigger templates (${expiredTemplates.length} auto-disabled due to expired projects)`);

      const results: { templateId: string; templateName: string; status: string; tasksCreated?: number; error?: string }[] = [];
      
      // Add auto-disabled templates to results
      for (const { template, projectEndDate } of expiredTemplates) {
        results.push({
          templateId: template.id,
          templateName: template.name,
          status: 'auto-disabled',
          error: `Project ended ${projectEndDate}`
        });
      }

      for (const template of activeTemplates) {
        try {
          // Simple check: is nextTriggerAt in the past?
          if (!template.nextTriggerAt) {
            // Template has no calculated next trigger time - calculate it now
            const nextOccurrence = calculateNextOccurrence(template);
            if (nextOccurrence) {
              await storage.updateTaskTemplate(template.id, {
                nextTriggerAt: nextOccurrence.nextTriggerAt,
                nextDueAt: nextOccurrence.nextDueAt,
              });
            }
            results.push({ 
              templateId: template.id, 
              templateName: template.name,
              status: 'not-due', 
              error: nextOccurrence ? `Initialized: Next trigger at ${nextOccurrence.nextTriggerAt}` : 'No valid schedule'
            });
            continue;
          }

          // Parse the stored nextTriggerAt (ISO 8601 with timezone)
          const nextTriggerTime = new Date(template.nextTriggerAt);
          
          // Check if it's time to trigger
          if (now < nextTriggerTime) {
            results.push({ 
              templateId: template.id, 
              templateName: template.name,
              status: 'not-due',
              error: `Waiting until: ${template.nextTriggerAt}. Server now: ${now.toISOString()}`
            });
            continue;
          }

          // Create tasks from template (uses template.nextDueAt directly)
          const { tasksCreated, subTasksCreated } = await createTasksFromTemplate(template, storage);

          // Update lastTriggeredAt and calculate next occurrence
          const nextOccurrence = calculateNextOccurrenceAfterTrigger(template);
          await storage.updateTaskTemplate(template.id, {
            lastTriggeredAt: now.toISOString(),
            lastUsedAt: now,
            ...(nextOccurrence && {
              nextTriggerAt: nextOccurrence.nextTriggerAt,
              nextDueAt: nextOccurrence.nextDueAt,
            }),
          });

          results.push({ 
            templateId: template.id, 
            templateName: template.name,
            status: 'triggered', 
            tasksCreated: tasksCreated + subTasksCreated 
          });

          console.log(`[Scheduler] Triggered template "${template.name}": ${tasksCreated} tasks, ${subTasksCreated} sub-tasks`);

        } catch (error: any) {
          console.error(`[Scheduler] Error triggering template ${template.id}:`, error);
          results.push({ 
            templateId: template.id, 
            templateName: template.name,
            status: 'error', 
            error: error.message 
          });
        }
      }

      const triggeredCount = results.filter(r => r.status === 'triggered').length;
      console.log(`[Scheduler] Completed: ${triggeredCount} templates triggered`);

      res.json({
        success: true,
        timestamp: now.toISOString(),
        templatesChecked: autoTriggerTemplates.length,
        templatesTriggered: triggeredCount,
        results
      });

    } catch (error: any) {
      console.error('[Scheduler] Error in trigger-deliverables:', error);
      res.status(500).json({ message: 'Failed to trigger deliverables', error: error.message });
    }
  });

  // GET /api/settings/:key - Get a specific app setting
  app.get('/api/settings/:key', isAuthenticated, async (req, res) => {
    try {
      const value = await storage.getAppSetting(req.params.key);
      res.json({ key: req.params.key, value: value ?? null });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to get setting', error: error.message });
    }
  });

  // PUT /api/settings/:key - Set a specific app setting (admin only)
  app.put('/api/settings/:key', isAuthenticated, requirePermission('canManageUsers'), async (req, res) => {
    try {
      const { value } = req.body;
      if (value === undefined || value === null) {
        return res.status(400).json({ message: 'Value is required' });
      }
      const userEmail = (req as any).user?.email || 'unknown';
      await storage.setAppSetting(req.params.key, String(value), userEmail);
      res.json({ key: req.params.key, value: String(value) });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to save setting', error: error.message });
    }
  });

  // POST /api/scheduler/auto-archive
  // Archives weekly reports if it's the appropriate day (Wednesday or later)
  app.post('/api/scheduler/auto-archive', async (req, res) => {
    try {
      // Optional: API key authentication for external schedulers
      const authHeader = req.headers['x-scheduler-key'];
      const schedulerKey = process.env.SCHEDULER_API_KEY;
      
      if (schedulerKey && authHeader !== schedulerKey) {
        return res.status(401).json({ message: 'Invalid scheduler key' });
      }

      // Check if auto-archive is enabled (defaults to enabled if not set)
      const autoArchiveEnabled = await storage.getAppSetting('auto_archive_enabled');
      if (autoArchiveEnabled === 'false') {
        return res.json({
          success: true,
          message: 'Auto-archive scheduler is disabled',
          archived: false,
          disabled: true
        });
      }

      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 3 = Wednesday
      
      console.log(`[Scheduler] Auto-archive called at ${now.toISOString()}, day of week: ${dayOfWeek}`);

      // Only run on Wednesday (3) or later in the week
      if (dayOfWeek < 3 && dayOfWeek !== 0) { // 0 is Sunday which comes after Saturday
        return res.json({
          success: true,
          message: 'Not archive day yet (runs Wednesday-Sunday)',
          archived: false
        });
      }

      // Get all submitted weekly reports that haven't been archived yet
      const weeklyReports = await storage.getWeeklyReports();
      const submittedReports = weeklyReports.filter(r => r.status === 'submitted');
      
      if (submittedReports.length === 0) {
        return res.json({
          success: true,
          message: 'No submitted reports to archive',
          archived: false
        });
      }

      // Get existing archives to find unarchived weeks
      const existingArchives = await storage.getSavedReports();
      const archivedWeeks = new Set(existingArchives.map(a => a.weekStart));
      
      // Find submitted reports for weeks that haven't been archived
      const unarchivedReports = submittedReports.filter(r => !archivedWeeks.has(r.weekStart));
      
      if (unarchivedReports.length === 0) {
        return res.json({
          success: true,
          message: 'All submitted reports already archived',
          archived: false
        });
      }

      // Group by weekStart and find the oldest unarchived week
      const weekGroups = unarchivedReports.reduce((acc, r) => {
        if (!acc[r.weekStart]) acc[r.weekStart] = [];
        acc[r.weekStart].push(r);
        return acc;
      }, {} as Record<string, typeof unarchivedReports>);
      
      const oldestWeekStart = Object.keys(weekGroups).sort()[0];
      const reportsForWeek = weekGroups[oldestWeekStart];
      
      // Calculate week end (6 days after start)
      const weekStartDate = new Date(oldestWeekStart);
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekEndDate.getDate() + 6);
      const weekEnd = weekEndDate.toISOString().split('T')[0];

      // Archive is needed - return info for the caller to handle
      // The actual archiving logic is complex (PDF generation, AI summary) so we just signal readiness
      res.json({
        success: true,
        message: 'Archive needed',
        weekStart: oldestWeekStart,
        weekEnd: weekEnd,
        reportsCount: reportsForWeek.length,
        archived: false,
        needsArchive: true
      });

    } catch (error: any) {
      console.error('[Scheduler] Error in auto-archive:', error);
      res.status(500).json({ message: 'Failed to check archive status', error: error.message });
    }
  });

  // GET /api/scheduler/status
  // Returns scheduler status and next scheduled runs
  app.get('/api/scheduler/status', async (_req, res) => {
    try {
      const allTemplates = await storage.getTaskTemplates();
      const autoTriggerTemplates = allTemplates.filter(t => 
        t.isActive === 'true' && 
        t.autoTriggerEnabled === 'true' &&
        t.recurrence
      );

      const templateStatus = autoTriggerTemplates.map(t => {
        return {
          id: t.id,
          name: t.name,
          recurrence: t.recurrence,
          lastTriggeredAt: t.lastTriggeredAt,
          nextScheduledStart: t.nextTriggerAt || null,
          nextScheduledDue: t.nextDueAt || null
        };
      });

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        autoTriggerTemplatesCount: autoTriggerTemplates.length,
        templates: templateStatus
      });

    } catch (error: any) {
      console.error('[Scheduler] Error getting status:', error);
      res.status(500).json({ message: 'Failed to get scheduler status', error: error.message });
    }
  });

  // POST /api/scheduler/generate-report-drafts
  // Generates AI drafts for all weekly reports using task activity data
  // Uses the current reporting week's weekStart at UTC 00:00:00 for 7 days
  app.post('/api/scheduler/generate-report-drafts', async (req, res) => {
    try {
      const authHeader = req.headers['x-scheduler-key'];
      const schedulerKey = process.env.SCHEDULER_API_KEY;
      
      if (schedulerKey && authHeader !== schedulerKey) {
        return res.status(401).json({ message: 'Invalid scheduler key' });
      }

      console.log(`[Scheduler] Generate report drafts called at ${new Date().toISOString()}`);

      const allReports = await storage.getWeeklyReports();
      const allTasks = await storage.getTasks();
      const allProjects = await storage.getProjects();
      const projectMap = new Map(allProjects.map(p => [p.id, p]));
      const taskMap = new Map(allTasks.map(t => [t.id, t]));

      // Determine the active reporting week from existing drafts, or use gap-aware logic
      const existingDrafts = allReports.filter(r => r.status === 'draft');
      let weekStart: string;
      if (existingDrafts.length > 0) {
        const weekStarts = [...new Set(existingDrafts.map(r => r.weekStart))].sort();
        weekStart = weekStarts[weekStarts.length - 1]; // Use the latest week with drafts
      } else {
        // Use gap-aware logic: advance one week at a time after last archive
        const now = new Date();
        const dayOfWeek = now.getUTCDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const currentMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + mondayOffset));
        const currentCalendarWeek = currentMonday.toISOString().split('T')[0];

        const savedReports = await storage.getSavedReports();
        if (savedReports.length > 0) {
          const sortedArchives = savedReports.sort((a, b) =>
            new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()
          );
          const latestArchivedDate = new Date(sortedArchives[0].weekStart + 'T00:00:00Z');
          const nextWeekAfterArchive = new Date(latestArchivedDate);
          nextWeekAfterArchive.setUTCDate(latestArchivedDate.getUTCDate() + 7);
          const nextWeekStart = `${nextWeekAfterArchive.getUTCFullYear()}-${String(nextWeekAfterArchive.getUTCMonth() + 1).padStart(2, '0')}-${String(nextWeekAfterArchive.getUTCDate()).padStart(2, '0')}`;

          // Only advance one week at a time - don't skip to current calendar week
          if (new Date(currentCalendarWeek + 'T00:00:00Z') > new Date(nextWeekStart + 'T00:00:00Z')) {
            weekStart = nextWeekStart;
            console.log(`[Scheduler] Gap-aware: Using next week after archive ${sortedArchives[0].weekStart} → ${nextWeekStart} (calendar: ${currentCalendarWeek})`);
          } else {
            weekStart = currentCalendarWeek;
          }
        } else {
          weekStart = currentCalendarWeek;
        }
      }

      const weekStartDate = new Date(weekStart + 'T00:00:00Z');
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6);
      weekEndDate.setUTCHours(23, 59, 59, 999);

      console.log(`[Scheduler] Processing week: ${weekStart} to ${weekEndDate.toISOString().split('T')[0]}`);

      // Get all activity for this week
      const allActivities = await storage.getActivitiesByDateRange(weekStartDate, weekEndDate);

      const projectActivities: Record<string, Array<{
        taskTitle: string;
        changeType: string;
        changedBy: string;
        previousValue: any;
        newValue: any;
        timestamp: Date;
      }>> = {};

      for (const activity of allActivities) {
        const task = taskMap.get(activity.taskId);
        if (!task?.projectId) continue;

        if (!projectActivities[task.projectId]) {
          projectActivities[task.projectId] = [];
        }
        projectActivities[task.projectId].push({
          taskTitle: task.title,
          changeType: activity.changeType,
          changedBy: activity.changedBy,
          previousValue: activity.previousValue,
          newValue: activity.newValue,
          timestamp: activity.changedAt
        });
      }

      // Build map of ALL existing reports (draft + submitted) for this week to avoid duplicates
      const allReportsForWeek = allReports.filter(r => r.weekStart === weekStart);
      const existingReportProjectIds = new Set(allReportsForWeek.map(r => r.projectId));
      const existingDraftMap = new Map(
        allReportsForWeek.filter(r => r.status === 'draft').map(r => [r.projectId, r])
      );

      // Auto-create draft reports for projects that have activity but no existing draft
      let autoCreatedCount = 0;
      for (const projectId of Object.keys(projectActivities)) {
        if (!existingReportProjectIds.has(projectId)) {
          const project = projectMap.get(projectId);
          if (!project) continue;
          const leadId = project.leadIds?.[0] || project.leadId;
          if (!leadId) continue;

          try {
            const newReport = await storage.createWeeklyReport({
              projectId,
              leadId,
              weekStart,
              status: 'draft',
              healthStatus: null,
              progress: null,
              challenges: null,
              nextWeek: null,
              teamMemberFeedback: null,
              submittedByLeadId: null,
            });
            existingDraftMap.set(projectId, newReport);
            autoCreatedCount++;
            console.log(`[Scheduler] Auto-created draft for "${project.name}"`);
          } catch (err: any) {
            console.error(`[Scheduler] Failed to auto-create draft for "${project.name}":`, err.message);
          }
        }
      }

      if (autoCreatedCount > 0) {
        console.log(`[Scheduler] Auto-created ${autoCreatedCount} draft reports`);
      }

      // Get all drafts to process (existing + newly created) that haven't been AI-drafted yet
      const draftsByWeek = [...existingDraftMap.values()].filter(r => !r.aiDraftStatus);

      if (draftsByWeek.length === 0 && autoCreatedCount === 0) {
        return res.json({ success: true, message: 'No draft reports to process', weekStart, draftsGenerated: 0 });
      }

      console.log(`[Scheduler] Generating AI drafts for ${draftsByWeek.length} reports`);

      const results: Array<{ reportId: string; projectName: string; status: string; error?: string }> = [];

      for (const report of draftsByWeek) {
        try {
          const project = projectMap.get(report.projectId);
          const projectName = project?.name || 'Unknown Project';
          const accountHeader = project?.steadyKey || project?.name?.replace(/\s+/g, '_') || 'No_Account';
          const activities = projectActivities[report.projectId] || [];

          if (report.aiDraftStatus === 'generated' || report.aiDraftStatus === 'edited') {
            results.push({ reportId: report.id, projectName, status: 'skipped_already_drafted' });
            continue;
          }

          if (activities.length === 0) {
            results.push({ reportId: report.id, projectName, status: 'skipped_no_activity' });
            continue;
          }

          const taskGroups: Record<string, { taskTitle: string; notes: string[]; statusChanges: string[]; otherChanges: string[]; changedBy: Set<string> }> = {};
          for (const a of activities) {
            if (!taskGroups[a.taskTitle]) {
              taskGroups[a.taskTitle] = { taskTitle: a.taskTitle, notes: [], statusChanges: [], otherChanges: [], changedBy: new Set() };
            }
            taskGroups[a.taskTitle].changedBy.add(a.changedBy);
            switch (a.changeType) {
              case 'created': taskGroups[a.taskTitle].otherChanges.push('Created'); break;
              case 'status_change': {
                const prev = (a.previousValue as any)?.status || 'unknown';
                const next = (a.newValue as any)?.status || 'unknown';
                taskGroups[a.taskTitle].statusChanges.push(`${prev} → ${next}`);
                break;
              }
              case 'note_added': {
                const note = (a.newValue as any)?.content || '';
                if (note) taskGroups[a.taskTitle].notes.push(note);
                break;
              }
              case 'priority_change': {
                const p = (a.newValue as any)?.priority || 'unknown';
                taskGroups[a.taskTitle].otherChanges.push(`Priority set to ${p}`);
                break;
              }
              case 'due_date_change': taskGroups[a.taskTitle].otherChanges.push('Due date updated'); break;
            }
          }

          const formattedActivities = Object.values(taskGroups).map(task => {
            const parts: string[] = [];
            if (task.notes.length > 0) parts.push(`Notes: ${task.notes.join(' | ')}`);
            if (task.statusChanges.length > 0) {
              const transitions = task.statusChanges.map(change => {
                const [from, to] = change.split(' → ');
                if (from === 'todo' && to === 'in-progress') return 'Started';
                if (to === 'done') return 'Completed';
                if (to === 'blocked') return 'Blocked';
                if (from === 'blocked' && to === 'in-progress') return 'Unblocked';
                if (to === 'cancelled') return 'Cancelled';
                return `${from} → ${to}`;
              });
              parts.push(`Progress: ${transitions.join(', ')}`);
            }
            if (task.otherChanges.includes('Created')) parts.push('Newly created');
            return `  - Task: "${task.taskTitle}" (by: ${Array.from(task.changedBy).join(', ')})\n    ${parts.join('\n    ')}`;
          }).join('\n');

          const systemPrompt = `You are a senior project lead writing a concise weekly report for a specific project/account.
Your goal is to summarize progress, identify challenges, and outline next steps based on task activity data.
Write in a professional tone suitable for management review.`;

          const userPrompt = `Generate a weekly report for project "${accountHeader}" based on the following task activity from the week of ${weekStart}.

Produce three sections:
1. PROGRESS: Summarize what was accomplished this week. Focus on outcomes, not individual actions. Write 2-4 concise bullet points.
2. CHALLENGES: Identify any blockers, issues, or tasks that were blocked during the week. If none, write "No significant challenges this week." Write 1-3 bullet points.
3. NEXT_STEPS: Based on in-progress tasks and the trajectory of work, suggest 1-3 next steps for the coming week.

Task activity for this project:
${formattedActivities}`;

          const completion = await openai.chat.completions.create({
            model: 'gpt-4.1-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            max_completion_tokens: 1000,
          });

          const aiOutput = completion.choices[0]?.message?.content || '';

          const progressMatch = aiOutput.match(/PROGRESS[:\s]*([\s\S]*?)(?=CHALLENGES|$)/i);
          const challengesMatch = aiOutput.match(/CHALLENGES[:\s]*([\s\S]*?)(?=NEXT_STEPS|$)/i);
          const nextStepsMatch = aiOutput.match(/NEXT_STEPS[:\s]*([\s\S]*?)$/i);

          const aiProgress = progressMatch?.[1]?.trim() || '';
          const aiChallenges = challengesMatch?.[1]?.trim() || '';
          const aiNextSteps = nextStepsMatch?.[1]?.trim() || '';

          const updates: Record<string, any> = { aiDraftStatus: 'generated' };

          const aiSeparator = '\n\n--- AI Draft (from task activity) ---\n';

          if (aiProgress) {
            updates.progress = report.progress
              ? report.progress + aiSeparator + aiProgress
              : aiProgress;
          }
          if (aiChallenges) {
            updates.challenges = report.challenges
              ? report.challenges + aiSeparator + aiChallenges
              : aiChallenges;
          }
          if (aiNextSteps) {
            updates.nextWeek = report.nextWeek
              ? report.nextWeek + aiSeparator + aiNextSteps
              : aiNextSteps;
          }

          await storage.updateWeeklyReport(report.id, updates);
          results.push({ reportId: report.id, projectName, status: 'drafted' });
          console.log(`[Scheduler] Generated draft for "${projectName}" (${activities.length} activities)`);

        } catch (error: any) {
          console.error(`[Scheduler] Error generating draft for report ${report.id}:`, error);
          results.push({ reportId: report.id, projectName: report.projectId, status: 'error', error: error.message });
        }
      }

      const draftedCount = results.filter(r => r.status === 'drafted').length;
      console.log(`[Scheduler] Completed: ${draftedCount}/${draftsByWeek.length} reports drafted (${autoCreatedCount} auto-created)`);

      res.json({
        success: true,
        weekStart,
        weekEnd: weekEndDate.toISOString().split('T')[0],
        totalReports: draftsByWeek.length,
        autoCreated: autoCreatedCount,
        draftsGenerated: draftedCount,
        results
      });

    } catch (error: any) {
      console.error('[Scheduler] Error generating report drafts:', error);
      res.status(500).json({ message: 'Failed to generate report drafts', error: error.message });
    }
  });

  // ====== AI CHAT Q&A ROUTES ======

  // Get all AI chat intents (for admin management)
  app.get('/api/ai-chat/intents', isAuthenticated, async (_req, res) => {
    try {
      const intents = await storage.getAiChatIntents();
      res.json(intents);
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to fetch AI chat intents' });
    }
  });

  // Update an AI chat intent (admin only)
  app.patch('/api/ai-chat/intents/:id', isAuthenticated, requirePermission('canManageRoles'), async (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body;
      const allowedFields: Record<string, boolean> = {
        systemPrompt: true,
        description: true,
        isEnabled: true,
        name: true,
        sortOrder: true,
      };
      const updates: Record<string, any> = {};
      for (const key of Object.keys(body)) {
        if (allowedFields[key]) {
          updates[key] = body[key];
        }
      }
      if (updates.isEnabled !== undefined && updates.isEnabled !== 'true' && updates.isEnabled !== 'false') {
        return res.status(400).json({ message: 'isEnabled must be "true" or "false"' });
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: 'No valid fields to update' });
      }
      const updated = await storage.updateAiChatIntent(id, updates);
      if (!updated) return res.status(404).json({ message: 'Intent not found' });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to update intent' });
    }
  });

  // AI Chat - main Q&A endpoint with streaming
  app.post('/api/ai-chat/ask', isAuthenticated, async (req: any, res) => {
    try {
      const { question, messageHistory = [], intentOverride } = req.body;
      if (!question || typeof question !== 'string' || question.trim().length === 0) {
        return res.status(400).json({ message: 'Question is required' });
      }
      if (!Array.isArray(messageHistory)) {
        return res.status(400).json({ message: 'messageHistory must be an array' });
      }
      if (intentOverride && typeof intentOverride !== 'string') {
        return res.status(400).json({ message: 'intentOverride must be a string' });
      }

      // Get enabled intents
      const allIntents = await storage.getAiChatIntents();
      const enabledIntents = allIntents.filter(i => i.isEnabled === 'true');

      // Detect intent from question (or use override)
      let detectedIntentKey = intentOverride || 'general';
      
      if (!intentOverride && enabledIntents.length > 1) {
        const intentList = enabledIntents
          .filter(i => i.intentKey !== 'general')
          .map(i => `- "${i.intentKey}": ${i.description}`)
          .join('\n');

        try {
          const classifyResponse = await openai.chat.completions.create({
            model: 'gpt-4.1-nano',
            messages: [
              {
                role: 'system',
                content: `You are an intent classifier. Given a user question, classify it into one of these intents:\n${intentList}\n- "general": General questions that don't fit other categories\n\nRespond with ONLY the intent key (e.g., "eod_report", "project_status", etc.). No explanation.`
              },
              { role: 'user', content: question }
            ],
            max_completion_tokens: 20,
          });
          const classifiedKey = classifyResponse.choices[0]?.message?.content?.trim().replace(/"/g, '') || 'general';
          if (enabledIntents.some(i => i.intentKey === classifiedKey)) {
            detectedIntentKey = classifiedKey;
          }
        } catch (err) {
          console.error('Intent classification failed, using general:', err);
        }
      }

      // Get the system prompt for the detected intent
      const matchedIntent = enabledIntents.find(i => i.intentKey === detectedIntentKey) 
        || enabledIntents.find(i => i.intentKey === 'general')
        || enabledIntents[0];

      // Fetch relevant data based on intent
      const userEmail = req.user.claims.email;

      // For EOD reports, extract date range and target person from the question
      let dateRange: { start: Date; end: Date } | undefined;
      let targetEmail = userEmail;
      if (detectedIntentKey === 'eod_report') {
        // Build a people lookup for the AI to match names/emails
        const allPeople = await storage.getAllPeople();
        const peopleList = allPeople.map(p => `${p.name} (${p.email || 'no email'})`).join(', ');

        try {
          const extractResponse = await openai.chat.completions.create({
            model: 'gpt-4.1-nano',
            messages: [
              {
                role: 'system',
                content: `Today is ${new Date().toISOString().split('T')[0]}. Extract TWO things from the user's question about an activity/EOD report:
1. Date range: "start" and "end" as YYYY-MM-DD. If "today" or no dates mentioned, use today for both. Single date = same for both. Use year ${new Date().getFullYear()} unless specified.
2. Target person: If the user mentions generating a report FOR someone else (by name or email), return their email. If no specific person mentioned or they say "me"/"my", return null.

Known team members: ${peopleList}

The current user's email is: ${userEmail}

Return ONLY a JSON object: {"start":"YYYY-MM-DD","end":"YYYY-MM-DD","personEmail":null or "email@example.com"}
No explanation.`
              },
              { role: 'user', content: question }
            ],
            max_completion_tokens: 80,
          });
          const json = extractResponse.choices[0]?.message?.content?.trim() || '';
          const parsed = JSON.parse(json);
          if (parsed.start && parsed.end) {
            const startDate = new Date(parsed.start + 'T00:00:00');
            const endDate = new Date(parsed.end + 'T23:59:59');
            if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
              dateRange = { start: startDate, end: endDate };
            }
          }
          if (parsed.personEmail && typeof parsed.personEmail === 'string') {
            // Verify the person exists
            const person = await storage.getPersonByEmail(parsed.personEmail);
            if (person) {
              targetEmail = parsed.personEmail;
            }
          }
        } catch (err) {
          // Fall back to today + current user if extraction fails
        }
      }

      const contextData = await fetchContextForIntent(detectedIntentKey, targetEmail, dateRange);

      // Build messages for OpenAI
      let systemMessage: string;
      let userMessage: string;

      if (detectedIntentKey === 'eod_report') {
        // Use the exact same system + user prompt structure as the Tasks section EOD report
        systemMessage = matchedIntent?.systemPrompt || `You are a senior team member writing a concise End of Day work update.
Your goal is to explain meaningful progress and outcomes, not list actions.
Think like a human reporting to a manager.`;

        userMessage = `Generate a professional End of Day update grouped by account/project.

Guidelines:
- Group the update by account/project.
- Within each account, summarize meaningful work in plain language.
- Do NOT list task names or individual actions.
- Combine all activity related to the same task into a single concise line.
- Use note content to infer outcomes, blockers resolved, communication done, or progress made.
- Focus on WHAT was accomplished or progressed, not HOW the system changed.
- Prefer outcomes like:
  - completed
  - progressed
  - unblocked
  - blocked
  - started
  - communicated
- Ignore low-signal actions unless they add context.
- Use past tense for completed work and present tense for ongoing work.

Formatting rules:
- Start with one high-level summary sentence.
- For each account, write ONE line in this exact format: account_key : summary of meaningful work done
  - Use the exact account/project key provided in the data (do NOT modify it - keep underscores, do not add spaces). Do NOT use markdown headers (no ## or **).
  - The summary after the colon should be a concise sentence describing meaningful outcomes.
  - If there are multiple distinct outcomes for one account, separate them with semicolons on the same line.

Activities (grouped by account and task):
${contextData}`;
      } else {
        systemMessage = `${matchedIntent?.systemPrompt || 'You are a helpful assistant.'}\n\nHere is the current data from the SSCMA Dashboard:\n\n${contextData}`;
        userMessage = question;
      }

      const messages: any[] = [
        { role: 'system', content: systemMessage },
        ...messageHistory.slice(-10).map((m: any) => ({
          role: m.role,
          content: m.content,
        })),
        { role: 'user', content: userMessage },
      ];

      // Stream the response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Send the detected intent as the first event
      res.write(`data: ${JSON.stringify({ type: 'intent', intentKey: detectedIntentKey, intentName: matchedIntent?.name })}\n\n`);

      const stream = await openai.chat.completions.create({
        model: detectedIntentKey === 'eod_report' ? 'gpt-5.2' : 'gpt-4.1-mini',
        messages,
        max_completion_tokens: 2000,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          res.write(`data: ${JSON.stringify({ type: 'content', content })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    } catch (error: any) {
      console.error('AI Chat error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to process AI chat request' });
      } else {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'An error occurred while generating the response.' })}\n\n`);
        res.end();
      }
    }
  });

  // Helper function to fetch context data based on intent
  async function fetchContextForIntent(intentKey: string, userEmail?: string, dateRange?: { start: Date; end: Date }): Promise<string> {
    try {
      const sections: string[] = [];

      // For EOD report, pull actual task activity (same as Tasks section EOD report)
      if (intentKey === 'eod_report' && userEmail) {
        const startDate = dateRange?.start || (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
        const endDate = dateRange?.end || new Date();
        
        const activities = await storage.getActivitiesByUser(userEmail, startDate, endDate);
        const allTasks = await storage.getTasks();
        const allProjects = await storage.getProjects();
        const taskMap = new Map(allTasks.map(t => [t.id, t]));
        const projectMap = new Map(allProjects.map(p => [p.id, p]));

        const accountActivities: Record<string, { accountName: string; activities: Array<{ taskTitle: string; changeType: string; previousValue: any; newValue: any; timestamp: Date }> }> = {};

        for (const activity of activities) {
          const task = taskMap.get(activity.taskId);
          const taskTitle = task?.title || 'Unknown Task';
          const projectId = task?.projectId;
          const project = projectId ? projectMap.get(projectId) : null;
          const accountHeader = project?.steadyKey || project?.name?.replace(/\s+/g, '_') || 'No_Account';
          const accountKey = project?.id || 'no-account';

          if (!accountActivities[accountKey]) {
            accountActivities[accountKey] = { accountName: accountHeader, activities: [] };
          }
          accountActivities[accountKey].activities.push({
            taskTitle, changeType: activity.changeType,
            previousValue: activity.previousValue, newValue: activity.newValue,
            timestamp: activity.changedAt
          });
        }

        const formattedActivities = Object.values(accountActivities).map(account => {
          const taskGroups: Record<string, { taskTitle: string; notes: string[]; statusChanges: string[]; otherChanges: string[] }> = {};
          for (const a of account.activities) {
            if (!taskGroups[a.taskTitle]) {
              taskGroups[a.taskTitle] = { taskTitle: a.taskTitle, notes: [], statusChanges: [], otherChanges: [] };
            }
            switch (a.changeType) {
              case 'created': taskGroups[a.taskTitle].otherChanges.push('Created'); break;
              case 'status_change': {
                const prev = (a.previousValue as any)?.status || 'unknown';
                const next = (a.newValue as any)?.status || 'unknown';
                taskGroups[a.taskTitle].statusChanges.push(`${prev} → ${next}`);
                break;
              }
              case 'note_added': {
                const note = (a.newValue as any)?.content || '';
                if (note) taskGroups[a.taskTitle].notes.push(note);
                break;
              }
              case 'priority_change': {
                const p = (a.newValue as any)?.priority || 'unknown';
                taskGroups[a.taskTitle].otherChanges.push(`Priority set to ${p}`);
                break;
              }
              case 'due_date_change': taskGroups[a.taskTitle].otherChanges.push('Due date updated'); break;
            }
          }
          const taskSummaries = Object.values(taskGroups).map(task => {
            const parts: string[] = [];
            if (task.notes.length > 0) parts.push(`Notes: ${task.notes.join(' | ')}`);
            if (task.statusChanges.length > 0) {
              const transitions = task.statusChanges.map(change => {
                const [from, to] = change.split(' → ');
                if (from === 'todo' && to === 'in-progress') return 'Started';
                if (to === 'done') return 'Completed';
                if (to === 'blocked') return 'Blocked';
                if (from === 'blocked' && to === 'in-progress') return 'Unblocked';
                if (to === 'cancelled') return 'Cancelled';
                return `${from} → ${to}`;
              });
              parts.push(`Progress: ${transitions.join(', ')}`);
            }
            if (task.otherChanges.includes('Created')) parts.push('Newly created');
            return `  - Task: "${task.taskTitle}"\n    ${parts.join('\n    ')}`;
          });
          return `**${account.accountName}**\n${taskSummaries.join('\n')}`;
        }).join('\n\n');

        const rangeLabel = dateRange
          ? `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`
          : 'today';
        if (activities.length > 0) {
          sections.push(`ACTIVITY FOR ${rangeLabel.toUpperCase()} (${activities.length} changes by ${userEmail}):\n${formattedActivities}`);
        } else {
          sections.push(`ACTIVITY FOR ${rangeLabel.toUpperCase()}: No task activity recorded for ${userEmail}.`);
        }
      }

      if (['task_query', 'person_activity', 'general', 'project_status'].includes(intentKey)) {
        const allTasks = await storage.getTasks();
        const activeTasks = allTasks.filter(t => t.status !== 'cancelled');
        
        const taskSummary = activeTasks.map(t => {
          const assignees = Array.isArray(t.assignedTo) ? t.assignedTo.join(', ') : 'Unassigned';
          const dueStr = t.dueDate ? String(t.dueDate).split('T')[0] : 'No due date';
          return `- [${t.status}] "${t.title}" | Assigned: ${assignees} | Due: ${dueStr} | Priority: ${t.priority || 'normal'} | Project: ${t.projectId || 'None'}`;
        }).join('\n');

        sections.push(`TASKS (${activeTasks.length} active):\n${taskSummary || 'No tasks found.'}`);
      }

      if (['project_status', 'eod_report', 'report_summary', 'general'].includes(intentKey)) {
        const allProjects = await storage.getProjects();
        const projectSummary = allProjects.map(p => {
          const members = Array.isArray(p.teamMembers) ? p.teamMembers.join(', ') : 'None';
          const leads = Array.isArray(p.projectLeads) ? p.projectLeads.join(', ') : 'None';
          return `- "${p.name}" (${p.type || 'unknown'}) | Status: ${p.status || 'active'} | Leads: ${leads} | Members: ${members}`;
        }).join('\n');

        sections.push(`PROJECTS (${allProjects.length}):\n${projectSummary || 'No projects found.'}`);
      }

      if (['person_activity', 'general'].includes(intentKey)) {
        const allPeople = await storage.getAllPeople();
        const peopleSummary = allPeople.map(p => {
          const roles = Array.isArray(p.roles) ? p.roles.join(', ') : 'None';
          return `- ${p.name} (${p.email || 'no email'}) | Roles: ${roles}`;
        }).join('\n');

        sections.push(`TEAM MEMBERS (${allPeople.length}):\n${peopleSummary || 'No team members found.'}`);
      }

      if (['report_summary', 'general'].includes(intentKey)) {
        const reports = await storage.getWeeklyReports();
        if (reports.length > 0) {
          const recentReports = reports.slice(0, 5);
          const reportSummary = recentReports.map(r => 
            `- ${r.projectId}: Week of ${r.weekStart} | Status: ${r.status || 'N/A'}`
          ).join('\n');
          sections.push(`RECENT WEEKLY REPORTS:\n${reportSummary}`);
        }
      }

      if (intentKey === 'usage_guide') {
        sections.push(`DASHBOARD FEATURES:
- Task Management: Create, assign, and track tasks across projects. Tasks support subtasks, priorities (normal/medium/high), statuses (todo/in-progress/done/cancelled), notes, and due dates.
- Weekly Reporting: Generate and archive weekly status reports for accounts. Reports include AI-generated summaries.
- Team Management: Manage people with roles (team member, project lead). Track assignments and workload.
- Recurring Deliverables: Create task templates that automatically generate tasks on a schedule (daily, weekly, biweekly, monthly).
- Project Management: Track SS and CMA accounts with team members, project leads, and JIRA integration.
- EOD Reports: Generate end-of-day reports summarizing task activities.
- AI Q&A: Ask questions about your dashboard data using natural language.`);
      }

      return sections.join('\n\n') || 'No specific data available for this query.';
    } catch (error) {
      console.error('Error fetching context data:', error);
      return 'Error retrieving dashboard data.';
    }
  }

  // Seed default AI chat intents on startup
  storage.seedDefaultIntents().catch(err => console.error('Failed to seed AI chat intents:', err));

  const httpServer = createServer(app);

  return httpServer;
}
