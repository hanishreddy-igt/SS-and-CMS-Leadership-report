import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLocation } from "wouter";
import { LayoutGrid, ArrowLeft, Check, X } from "lucide-react";

type UserRole = "admin" | "manager" | "lead" | "member";

const roleColors: Record<UserRole, string> = {
  admin: "bg-red-500/20 text-red-600 border-red-500/30",
  manager: "bg-purple-500/20 text-purple-600 border-purple-500/30",
  lead: "bg-blue-500/20 text-blue-600 border-blue-500/30",
  member: "bg-gray-500/20 text-gray-600 border-gray-500/30",
};

const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  manager: "Manager",
  lead: "SS/CMS Lead",
  member: "SS/CMS Team Member",
};

const FEATURE_PERMISSIONS: Record<string, { label: string; description: string; roles: Record<UserRole, boolean> }> = {
  canManageUsers: {
    label: "Manage Users",
    description: "Add, edit, and manage user roles and role requests",
    roles: { admin: true, manager: false, lead: false, member: false },
  },
  canAddEditContracts: {
    label: "Add/Edit Contracts",
    description: "Create new contracts and modify existing contract details",
    roles: { admin: true, manager: true, lead: true, member: false },
  },
  canDeleteContracts: {
    label: "Delete Contracts",
    description: "Remove contracts from the system",
    roles: { admin: true, manager: true, lead: false, member: false },
  },
  canAddEditTeamMembers: {
    label: "Add/Edit Team Members",
    description: "Add new team members and modify their information",
    roles: { admin: true, manager: true, lead: true, member: true },
  },
  canAddEditProjectLeads: {
    label: "Add/Edit Project Leads",
    description: "Add new project leads and modify their information",
    roles: { admin: true, manager: true, lead: true, member: false },
  },
  canDeletePeople: {
    label: "Delete People",
    description: "Remove team members or project leads from the system",
    roles: { admin: true, manager: true, lead: false, member: false },
  },
  canSubmitReports: {
    label: "Submit Reports",
    description: "Submit weekly status reports for projects",
    roles: { admin: true, manager: true, lead: true, member: false },
  },
  canSaveDraft: {
    label: "Save Draft Reports",
    description: "Save report progress as draft before submitting",
    roles: { admin: true, manager: true, lead: true, member: true },
  },
  canEditOwnReports: {
    label: "Edit Reports",
    description: "Modify previously submitted reports",
    roles: { admin: true, manager: true, lead: true, member: true },
  },
  canDeleteReports: {
    label: "Delete Reports",
    description: "Delete submitted or draft reports",
    roles: { admin: true, manager: true, lead: false, member: false },
  },
  canExportReports: {
    label: "Export All Account Reports",
    description: "Export reports to PDF or CSV format",
    roles: { admin: true, manager: true, lead: true, member: false },
  },
  canArchiveReports: {
    label: "Archive Reports (Force Archive)",
    description: "Archive weekly reports for historical reference",
    roles: { admin: true, manager: true, lead: false, member: false },
  },
  canViewHistoricalAccountReports: {
    label: "View Historical Account Reports",
    description: "Access archived historical account reports",
    roles: { admin: true, manager: true, lead: true, member: true },
  },
  canViewHistoricalTeamReports: {
    label: "View Historical Team Feedback Reports",
    description: "Access archived historical team feedback reports",
    roles: { admin: true, manager: true, lead: false, member: false },
  },
  canGenerateAISummary: {
    label: "Generate AI Summary",
    description: "Generate AI-powered summaries of reports",
    roles: { admin: true, manager: true, lead: true, member: false },
  },
  canViewAISummary: {
    label: "View AI Summary for Account Reports",
    description: "View generated AI summaries for account reports",
    roles: { admin: true, manager: true, lead: true, member: true },
  },
  canViewTeamFeedbackAISummary: {
    label: "View AI Summary for Team Feedback",
    description: "View AI-generated team feedback summary and download team reports",
    roles: { admin: true, manager: true, lead: false, member: false },
  },
  canSubmitFeedback: {
    label: "Submit Co-worker Feedback",
    description: "Submit feedback on any working professional of SS/CMS Team",
    roles: { admin: true, manager: true, lead: true, member: true },
  },
  canViewOwnSubmittedFeedback: {
    label: "View Submitted Member Feedback",
    description: "View only feedbacks submitted by the user to keep track",
    roles: { admin: true, manager: true, lead: true, member: true },
  },
  canViewAllFeedback: {
    label: "View All SS/CMS Team Feedback",
    description: "View all feedback submitted by anyone (anonymous view)",
    roles: { admin: true, manager: true, lead: false, member: false },
  },
};

const featureCategories = [
  { name: "User Management", features: ["canManageUsers"] },
  { name: "Contract Operations", features: ["canAddEditContracts", "canDeleteContracts"] },
  { name: "People Management", features: ["canAddEditTeamMembers", "canAddEditProjectLeads", "canDeletePeople"] },
  { name: "Report Submission", features: ["canSaveDraft", "canEditOwnReports", "canSubmitReports", "canDeleteReports"] },
  { name: "Account Reports & Archive", features: ["canExportReports", "canArchiveReports", "canViewHistoricalAccountReports"] },
  { name: "AI Summaries", features: ["canGenerateAISummary", "canViewAISummary", "canViewTeamFeedbackAISummary"] },
  { name: "Team Feedback Reports & Archive", features: ["canSubmitFeedback", "canViewOwnSubmittedFeedback", "canViewAllFeedback", "canViewHistoricalTeamReports"] },
];

const roles: UserRole[] = ["admin", "manager", "lead", "member"];

export default function FeaturePanel() {
  const [, setLocation] = useLocation();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutGrid className="h-6 w-6" />
            Feature Panel
          </h1>
          <p className="text-muted-foreground">View feature permissions by role</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            Feature Permissions Matrix
          </CardTitle>
          <CardDescription>
            Overview of all features and which roles have access to each feature.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {featureCategories.map((category) => (
              <div key={category.name} className="space-y-3">
                <h3 className="font-semibold text-lg border-b pb-2">{category.name}</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/3">Feature</TableHead>
                      {roles.map((role) => (
                        <TableHead key={role} className="text-center">
                          <Badge className={roleColors[role]}>{roleLabels[role]}</Badge>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {category.features.map((featureKey) => {
                      const feature = FEATURE_PERMISSIONS[featureKey];
                      if (!feature) return null;
                      return (
                        <TableRow key={featureKey} data-testid={`row-feature-${featureKey}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{feature.label}</p>
                              <p className="text-xs text-muted-foreground">{feature.description}</p>
                            </div>
                          </TableCell>
                          {roles.map((role) => (
                            <TableCell key={role} className="text-center">
                              {feature.roles[role] ? (
                                <Check className="h-5 w-5 text-success mx-auto" />
                              ) : (
                                <X className="h-5 w-5 text-muted-foreground/40 mx-auto" />
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ))}

            <div className="grid grid-cols-4 gap-4 pt-4 border-t">
              {roles.map((role) => {
                const permissionCount = Object.values(FEATURE_PERMISSIONS).filter(
                  (f) => f.roles[role]
                ).length;
                const totalCount = Object.keys(FEATURE_PERMISSIONS).length;
                return (
                  <Card key={role} className="text-center">
                    <CardContent className="pt-4">
                      <Badge className={`${roleColors[role]} mb-2`}>{roleLabels[role]}</Badge>
                      <p className="text-2xl font-bold">
                        {permissionCount}/{totalCount}
                      </p>
                      <p className="text-xs text-muted-foreground">Features Enabled</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
