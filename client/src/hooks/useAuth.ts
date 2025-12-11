import { useQuery } from "@tanstack/react-query";

export type UserRole = 'admin' | 'manager' | 'lead' | 'member';

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string | null;
  role: UserRole;
}

interface EffectiveRole {
  actualRole: UserRole;
  effectiveRole: UserRole;
  isOverridden: boolean;
}

export function useAuth() {
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const { data: roleData } = useQuery<EffectiveRole>({
    queryKey: ["/api/users/effective-role"],
    enabled: !!user,
  });

  const effectiveRole = roleData?.effectiveRole || user?.role || 'member';
  const isRoleOverridden = roleData?.isOverridden || false;
  const actualRole = roleData?.actualRole || user?.role || 'member';

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    role: effectiveRole,
    actualRole,
    isRoleOverridden,
    isAdmin: actualRole === 'admin', // True admin (not overridden)
  };
}

// Role hierarchy for permission checking
const roleHierarchy: Record<UserRole, number> = {
  'admin': 4,
  'manager': 3,
  'lead': 2,
  'member': 1
};

// Permission definitions based on user requirements
// 1. Manage Users/Roles - admin only
// 2. Archive/Delete Reports - admin, manager
// 3. View Member Feedback - admin, manager
// 4. Delete/download Historical reports - admin, manager
// 5. Delete contracts - admin, manager
// 6. Delete Team leads - admin, manager, lead
// 7. Delete Team Members - admin, manager, lead
// 8. Submit reports - admin, manager, lead
// 9. Generate AI summary - admin, manager, lead
// 10. View AI Summary - admin, manager, lead
// 11. View Historical reports - admin, manager, lead
// 12. Export PDF/CSV - admin, manager, lead
// 13. Add/Edit contracts - admin, manager, lead, member
// 14. Add/Edit Team leads - admin, manager, lead, member
// 15. Add/Edit Team Members - admin, manager, lead, member
// 16. Save as Draft - admin, manager, lead, member
// 17. Submit Feedback - admin, manager, lead, member

export type Permission = 
  | 'manage_users'           // 1
  | 'archive_reports'        // 2
  | 'delete_reports'         // 2
  | 'view_member_feedback'   // 3
  | 'delete_historical'      // 4
  | 'download_historical'    // 4
  | 'delete_contracts'       // 5
  | 'delete_leads'           // 6
  | 'delete_members'         // 7
  | 'submit_reports'         // 8
  | 'generate_ai_summary'    // 9
  | 'view_ai_summary'        // 10
  | 'view_historical'        // 11
  | 'export_reports'         // 12
  | 'add_edit_contracts'     // 13
  | 'add_edit_leads'         // 14
  | 'add_edit_members'       // 15
  | 'save_draft'             // 16
  | 'submit_feedback';       // 17

const permissionRoles: Record<Permission, UserRole> = {
  'manage_users': 'admin',
  'archive_reports': 'manager',
  'delete_reports': 'manager',
  'view_member_feedback': 'manager',
  'delete_historical': 'manager',
  'download_historical': 'manager',
  'delete_contracts': 'manager',
  'delete_leads': 'lead',
  'delete_members': 'lead',
  'submit_reports': 'lead',
  'generate_ai_summary': 'lead',
  'view_ai_summary': 'lead',
  'view_historical': 'lead',
  'export_reports': 'lead',
  'add_edit_contracts': 'member',
  'add_edit_leads': 'member',
  'add_edit_members': 'member',
  'save_draft': 'member',
  'submit_feedback': 'member',
};

export function usePermissions() {
  const { role } = useAuth();

  const hasPermission = (permission: Permission): boolean => {
    const requiredRole = permissionRoles[permission];
    return roleHierarchy[role] >= roleHierarchy[requiredRole];
  };

  const hasMinRole = (minRole: UserRole): boolean => {
    return roleHierarchy[role] >= roleHierarchy[minRole];
  };

  return {
    hasPermission,
    hasMinRole,
    role,
    // Convenience methods for common checks
    canManageUsers: hasPermission('manage_users'),
    canArchiveReports: hasPermission('archive_reports'),
    canDeleteReports: hasPermission('delete_reports'),
    canViewMemberFeedback: hasPermission('view_member_feedback'),
    canDeleteHistorical: hasPermission('delete_historical'),
    canDownloadHistorical: hasPermission('download_historical'),
    canDeleteContracts: hasPermission('delete_contracts'),
    canDeleteLeads: hasPermission('delete_leads'),
    canDeleteMembers: hasPermission('delete_members'),
    canSubmitReports: hasPermission('submit_reports'),
    canGenerateAiSummary: hasPermission('generate_ai_summary'),
    canViewAiSummary: hasPermission('view_ai_summary'),
    canViewHistorical: hasPermission('view_historical'),
    canExportReports: hasPermission('export_reports'),
    canAddEditContracts: hasPermission('add_edit_contracts'),
    canAddEditLeads: hasPermission('add_edit_leads'),
    canAddEditMembers: hasPermission('add_edit_members'),
    canSaveDraft: hasPermission('save_draft'),
    canSubmitFeedback: hasPermission('submit_feedback'),
  };
}
