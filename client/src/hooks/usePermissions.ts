import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";

export type UserRole = "admin" | "manager" | "lead" | "member";

export interface Permissions {
  canManageUsers: boolean;
  canAddContracts: boolean;
  canEditContracts: boolean;
  canDeleteContracts: boolean;
  canViewAllContracts: boolean;
  canAddTeamMembers: boolean;
  canEditTeamMembers: boolean;
  canAddProjectLeads: boolean;
  canEditProjectLeads: boolean;
  canDeletePeople: boolean;
  canSubmitReports: boolean;
  canEditOwnReports: boolean;
  canDeleteReports: boolean;
  canViewAllReports: boolean;
  canViewOwnReports: boolean;
  canExportReports: boolean;
  canArchiveReports: boolean;
  canGenerateAISummary: boolean;
  canRegenerateAISummary: boolean;
  canViewAISummary: boolean;
  canSubmitFeedback: boolean;
  canViewAllFeedback: boolean;
  canViewTeamFeedbackSummary: boolean;
  canDeleteTeamFeedback: boolean;
  role: UserRole;
  isAdmin: boolean;
}

const ROLE_PERMISSIONS: Record<UserRole, Omit<Permissions, "role" | "isAdmin">> = {
  admin: {
    canManageUsers: true,
    canAddContracts: true,
    canEditContracts: true,
    canDeleteContracts: true,
    canViewAllContracts: true,
    canAddTeamMembers: true,
    canEditTeamMembers: true,
    canAddProjectLeads: true,
    canEditProjectLeads: true,
    canDeletePeople: true,
    canSubmitReports: true,
    canEditOwnReports: true,
    canDeleteReports: true,
    canViewAllReports: true,
    canViewOwnReports: true,
    canExportReports: true,
    canArchiveReports: true,
    canGenerateAISummary: true,
    canRegenerateAISummary: true,
    canViewAISummary: true,
    canSubmitFeedback: true,
    canViewAllFeedback: true,
    canViewTeamFeedbackSummary: true,
    canDeleteTeamFeedback: true,
  },
  manager: {
    canManageUsers: false,
    canAddContracts: true,
    canEditContracts: true,
    canDeleteContracts: true,
    canViewAllContracts: true,
    canAddTeamMembers: true,
    canEditTeamMembers: true,
    canAddProjectLeads: true,
    canEditProjectLeads: true,
    canDeletePeople: true,
    canSubmitReports: true,
    canEditOwnReports: true,
    canDeleteReports: true,
    canViewAllReports: true,
    canViewOwnReports: true,
    canExportReports: true,
    canArchiveReports: true,
    canGenerateAISummary: true,
    canRegenerateAISummary: true,
    canViewAISummary: true,
    canSubmitFeedback: true,
    canViewAllFeedback: true,
    canViewTeamFeedbackSummary: true,
    canDeleteTeamFeedback: true,
  },
  lead: {
    canManageUsers: false,
    canAddContracts: true,
    canEditContracts: true,
    canDeleteContracts: false,
    canViewAllContracts: true,
    canAddTeamMembers: true,
    canEditTeamMembers: true,
    canAddProjectLeads: true,
    canEditProjectLeads: true,
    canDeletePeople: false,
    canSubmitReports: true,
    canEditOwnReports: true,
    canDeleteReports: false,
    canViewAllReports: true,
    canViewOwnReports: true,
    canExportReports: true,
    canArchiveReports: false,
    canGenerateAISummary: true,
    canRegenerateAISummary: false,
    canViewAISummary: true,
    canSubmitFeedback: true,
    canViewAllFeedback: false,
    canViewTeamFeedbackSummary: false,
    canDeleteTeamFeedback: false,
  },
  member: {
    canManageUsers: false,
    canAddContracts: false,
    canEditContracts: false,
    canDeleteContracts: false,
    canViewAllContracts: true,
    canAddTeamMembers: true,
    canEditTeamMembers: true,
    canAddProjectLeads: false,
    canEditProjectLeads: false,
    canDeletePeople: false,
    canSubmitReports: false,
    canEditOwnReports: true,
    canDeleteReports: false,
    canViewAllReports: true,
    canViewOwnReports: true,
    canExportReports: false,
    canArchiveReports: false,
    canGenerateAISummary: false,
    canRegenerateAISummary: false,
    canViewAISummary: true,
    canSubmitFeedback: true,
    canViewAllFeedback: false,
    canViewTeamFeedbackSummary: false,
    canDeleteTeamFeedback: false,
  },
};

export function usePermissions(): Permissions {
  const { user } = useAuth();
  
  const { data: roleData } = useQuery<{ actualRole: UserRole; effectiveRole: UserRole }>({
    queryKey: ["/api/users/effective-role"],
    enabled: !!user,
  });

  const effectiveRole = roleData?.effectiveRole || "member";
  const permissions = ROLE_PERMISSIONS[effectiveRole];

  return {
    ...permissions,
    role: effectiveRole,
    isAdmin: roleData?.actualRole === "admin",
  };
}
