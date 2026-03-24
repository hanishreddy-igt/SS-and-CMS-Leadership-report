import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, usePermissions, UserRole } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Shield, Users, Clock, CheckCircle, XCircle, ArrowLeft, LayoutGrid, Check, X, Trash2, Plus, Sparkles, Save, Settings, Archive } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  role: UserRole;
  createdAt: string;
}

interface RoleRequest {
  id: string;
  userId: string;
  userEmail: string;
  currentRole: string;
  requestedRole: string;
  reason?: string;
  status: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

const roleColors: Record<UserRole, string> = {
  admin: "bg-red-500/20 text-red-600 border-red-500/30",
  manager: "bg-purple-500/20 text-purple-600 border-purple-500/30",
  lead: "bg-blue-500/20 text-blue-600 border-blue-500/30",
  member: "bg-muted text-muted-foreground border-border",
};

const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  manager: "Manager",
  lead: "SS/CMS Lead",
  member: "SS/CMS Team Member",
};

// Feature permissions matrix - matches usePermissions.ts
const FEATURE_PERMISSIONS: Record<string, { label: string; description: string; roles: Record<UserRole, boolean> }> = {
  canManageUsers: {
    label: "Manage Users",
    description: "Add, edit, and manage user roles and role requests",
    roles: { admin: true, manager: false, lead: false, member: false },
  },
  canAddContracts: {
    label: "Add Contracts",
    description: "Create new contracts in the system",
    roles: { admin: true, manager: true, lead: true, member: false },
  },
  canEditContracts: {
    label: "Edit Contracts",
    description: "Modify existing contract details",
    roles: { admin: true, manager: true, lead: true, member: true },
  },
  canDeleteContracts: {
    label: "Delete Contracts",
    description: "Remove contracts from the system",
    roles: { admin: true, manager: true, lead: false, member: false },
  },
  canViewAllContracts: {
    label: "View All Contracts",
    description: "Access and view all contracts in the system",
    roles: { admin: true, manager: true, lead: true, member: true },
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
  canViewAllReports: {
    label: "View All Account Reports",
    description: "Access and view all submitted reports",
    roles: { admin: true, manager: true, lead: true, member: true },
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
    label: "View AI Summary",
    description: "View generated AI summaries",
    roles: { admin: true, manager: true, lead: true, member: true },
  },
  canSubmitFeedback: {
    label: "Submit Co-worker Feedback",
    description: "Submit feedback on any working professional of SS/CMS Team",
    roles: { admin: true, manager: true, lead: true, member: true },
  },
  canViewOwnSubmittedFeedback: {
    label: "View Submitted Member Feedback",
    description: "View only feedbacks submitted by the user to keep track",
    roles: { admin: false, manager: false, lead: true, member: true },
  },
  canViewAllFeedback: {
    label: "View All SS/CMS Team Feedback",
    description: "View all feedback submitted by anyone (anonymous view)",
    roles: { admin: true, manager: true, lead: false, member: false },
  },
  canViewTeamFeedbackSummary: {
    label: "View Team Feedback Summary",
    description: "View AI-generated team feedback summary and download team reports",
    roles: { admin: true, manager: true, lead: false, member: false },
  },
};

const featureCategories = [
  { name: "User Management", features: ["canManageUsers"] },
  { name: "Contract Operations", features: ["canAddContracts", "canEditContracts", "canDeleteContracts", "canViewAllContracts"] },
  { name: "People Management", features: ["canAddEditTeamMembers", "canAddEditProjectLeads", "canDeletePeople"] },
  { name: "Report Submission", features: ["canSubmitReports", "canSaveDraft", "canEditOwnReports", "canDeleteReports"] },
  { name: "Account Reports & Archive", features: ["canViewAllReports", "canExportReports", "canArchiveReports", "canViewHistoricalAccountReports"] },
  { name: "AI Summaries", features: ["canGenerateAISummary", "canViewAISummary"] },
  { name: "Team Feedback Reports & Archive", features: ["canSubmitFeedback", "canViewOwnSubmittedFeedback", "canViewAllFeedback", "canViewTeamFeedbackSummary", "canViewHistoricalTeamReports"] },
];

const roles: UserRole[] = ["admin", "manager", "lead", "member"];

export default function AdminPanel() {
  const { isAdmin } = useAuth();
  const { canManageUsers } = usePermissions();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: canManageUsers,
  });

  const { data: roleRequests = [], isLoading: requestsLoading } = useQuery<RoleRequest[]>({
    queryKey: ["/api/role-requests"],
    enabled: canManageUsers,
  });

  const pendingRequests = roleRequests.filter((r) => r.status === "pending");
  const resolvedRequests = roleRequests.filter((r) => r.status !== "pending");

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      return apiRequest("PATCH", `/api/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Role Updated", description: "User role has been updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update user role.", variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User Deleted", description: "User has been removed from the system." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete user.", variant: "destructive" });
    },
  });

  const resolveRequestMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "denied" }) => {
      return apiRequest("PATCH", `/api/role-requests/${id}`, { status });
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/role-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: status === "approved" ? "Request Approved" : "Request Denied",
        description:
          status === "approved"
            ? "The role upgrade has been applied."
            : "The role upgrade request has been denied.",
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to process role request.", variant: "destructive" });
    },
  });

  // Add User dialog state
  const ALLOWED_DOMAINS = ['ignitetech.com', 'khoros.com'] as const;
  type EmailDomain = typeof ALLOWED_DOMAINS[number];
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserDomain, setNewUserDomain] = useState<EmailDomain>("ignitetech.com");
  const [newUserFirstName, setNewUserFirstName] = useState("");
  const [newUserLastName, setNewUserLastName] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("member");

  const createUserMutation = useMutation({
    mutationFn: async (userData: { email: string; firstName?: string; lastName?: string; role: UserRole }) => {
      return apiRequest("POST", "/api/users", userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User Created", description: "User has been added successfully." });
      setShowAddUserDialog(false);
      setNewUserEmail("");
      setNewUserDomain("ignitetech.com");
      setNewUserFirstName("");
      setNewUserLastName("");
      setNewUserRole("member");
    },
    onError: (error: any) => {
      const message = error?.message || "Failed to create user.";
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });

  const handleAddUser = () => {
    if (!newUserEmail.trim()) {
      toast({ title: "Error", description: "Username is required.", variant: "destructive" });
      return;
    }
    const fullEmail = `${newUserEmail.trim()}@${newUserDomain}`;
    createUserMutation.mutate({
      email: fullEmail,
      firstName: newUserFirstName.trim() || undefined,
      lastName: newUserLastName.trim() || undefined,
      role: newUserRole,
    });
  };

  // Bulk selection state
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showBulkRoleDialog, setShowBulkRoleDialog] = useState(false);
  const [bulkRole, setBulkRole] = useState<UserRole>("member");
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map((u) => u.id)));
    }
  };

  const clearSelection = () => {
    setSelectedUsers(new Set());
  };

  // Bulk role update
  const bulkUpdateRoleMutation = useMutation({
    mutationFn: async ({ userIds, role }: { userIds: string[]; role: UserRole }) => {
      return apiRequest("PATCH", "/api/users/bulk-role", { userIds, role });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Roles Updated", description: data.message || `Updated ${selectedUsers.size} user(s) to ${roleLabels[bulkRole]}.` });
      setShowBulkRoleDialog(false);
      clearSelection();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update user roles.", variant: "destructive" });
    },
  });

  // Bulk delete
  const bulkDeleteMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      return apiRequest("DELETE", "/api/users/bulk", { userIds });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Users Deleted", description: data.message || `Deleted ${selectedUsers.size} user(s).` });
      setShowBulkDeleteDialog(false);
      clearSelection();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete users.", variant: "destructive" });
    },
  });

  const handleBulkRoleUpdate = () => {
    bulkUpdateRoleMutation.mutate({ userIds: Array.from(selectedUsers), role: bulkRole });
  };

  const handleBulkDelete = () => {
    bulkDeleteMutation.mutate(Array.from(selectedUsers));
  };

  if (!canManageUsers) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Access Denied
            </h1>
            <p className="text-muted-foreground">You don't have permission to access the Admin Panel.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Admin Panel
            </h1>
            <p className="text-muted-foreground">Manage users and role requests</p>
          </div>
        </div>
        {pendingRequests.length > 0 && (
          <Badge className="bg-warning/20 text-warning border-warning/30">
            {pendingRequests.length} Pending Request{pendingRequests.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="gap-2" data-testid="tab-users">
            <Users className="h-4 w-4" />
            Users ({users.length})
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2" data-testid="tab-requests">
            <Clock className="h-4 w-4" />
            Role Requests
            {pendingRequests.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="ai-prompts" className="gap-2" data-testid="tab-ai-prompts">
            <Sparkles className="h-4 w-4" />
            AI Prompts
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2" data-testid="tab-settings">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>View and manage user roles in the system.</CardDescription>
              </div>
              <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-user">
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                    <DialogDescription>
                      Pre-configure a user before they log in. Email must be from @ignitetech.com or @khoros.com domain.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <div className="flex">
                        <Input
                          id="email"
                          type="text"
                          placeholder="username"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value.replace(/@.*$/, ''))}
                          className="rounded-r-none flex-1"
                          data-testid="input-new-user-email"
                        />
                        <Select value={newUserDomain} onValueChange={(v) => setNewUserDomain(v as EmailDomain)}>
                          <SelectTrigger className="w-[160px] rounded-l-none border-l-0" data-testid="select-new-user-domain">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ALLOWED_DOMAINS.map(domain => (
                              <SelectItem key={domain} value={domain}>@{domain}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          placeholder="John"
                          value={newUserFirstName}
                          onChange={(e) => setNewUserFirstName(e.target.value)}
                          data-testid="input-new-user-firstname"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          placeholder="Doe"
                          value={newUserLastName}
                          onChange={(e) => setNewUserLastName(e.target.value)}
                          data-testid="input-new-user-lastname"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select value={newUserRole} onValueChange={(value) => setNewUserRole(value as UserRole)}>
                        <SelectTrigger data-testid="select-new-user-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="lead">SS/CMS Lead</SelectItem>
                          <SelectItem value="member">SS/CMS Team Member</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddUserDialog(false)} data-testid="button-cancel-add-user">
                      Cancel
                    </Button>
                    <Button onClick={handleAddUser} disabled={createUserMutation.isPending} data-testid="button-confirm-add-user">
                      {createUserMutation.isPending ? "Adding..." : "Add User"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            {selectedUsers.size > 0 && (
              <div className="flex items-center justify-between gap-4 px-6 py-3 bg-muted/50 border-b">
                <span className="text-sm text-muted-foreground">
                  {selectedUsers.size} user{selectedUsers.size > 1 ? "s" : ""} selected
                </span>
                <div className="flex items-center gap-2">
                  <Select value={bulkRole} onValueChange={(value) => setBulkRole(value as UserRole)}>
                    <SelectTrigger className="w-40" data-testid="select-bulk-role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="lead">SS/CMS Lead</SelectItem>
                      <SelectItem value="member">SS/CMS Team Member</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => setShowBulkRoleDialog(true)}
                    data-testid="button-bulk-change-role"
                  >
                    Change Role
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setShowBulkDeleteDialog(true)}
                    data-testid="button-bulk-delete"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={clearSelection}
                    data-testid="button-clear-selection"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}
            <CardContent>
              {usersLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading users...</div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No users found.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedUsers.size === users.length && users.length > 0}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all users"
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Current Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedUsers.has(user.id)}
                            onCheckedChange={() => toggleUserSelection(user.id)}
                            aria-label={`Select ${user.displayName || user.email}`}
                            data-testid={`checkbox-user-${user.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {user.displayName || user.firstName || user.email?.split("@")[0] || "Unknown"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          <Badge className={roleColors[user.role]}>{roleLabels[user.role]}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(role) =>
                              updateRoleMutation.mutate({ userId: user.id, role: role as UserRole })
                            }
                          >
                            <SelectTrigger className="w-32" data-testid={`select-role-${user.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="lead">SS/CMS Lead</SelectItem>
                              <SelectItem value="member">SS/CMS Team Member</SelectItem>
                            </SelectContent>
                          </Select>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" data-testid={`button-delete-user-${user.id}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete {user.displayName || user.email}? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel data-testid={`button-cancel-delete-${user.id}`}>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteUserMutation.mutate(user.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  data-testid={`button-confirm-delete-${user.id}`}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>

            <Dialog open={showBulkRoleDialog} onOpenChange={setShowBulkRoleDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Change Role for {selectedUsers.size} User{selectedUsers.size > 1 ? "s" : ""}</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to change the role for the selected users to {roleLabels[bulkRole]}?
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowBulkRoleDialog(false)} data-testid="button-cancel-bulk-role">
                    Cancel
                  </Button>
                  <Button onClick={handleBulkRoleUpdate} disabled={bulkUpdateRoleMutation.isPending} data-testid="button-confirm-bulk-role">
                    {bulkUpdateRoleMutation.isPending ? "Updating..." : "Change Role"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selectedUsers.size} User{selectedUsers.size > 1 ? "s" : ""}</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete the selected users? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-bulk-delete">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleBulkDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={bulkDeleteMutation.isPending}
                    data-testid="button-confirm-bulk-delete"
                  >
                    {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Card>
        </TabsContent>

        <TabsContent value="requests">
          <div className="space-y-6">
            {/* Pending Requests */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-warning" />
                  Pending Requests
                </CardTitle>
                <CardDescription>Review and approve or deny role upgrade requests.</CardDescription>
              </CardHeader>
              <CardContent>
                {requestsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading requests...</div>
                ) : pendingRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No pending requests.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Current Role</TableHead>
                        <TableHead>Requested Role</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingRequests.map((request) => (
                        <TableRow key={request.id} data-testid={`row-request-${request.id}`}>
                          <TableCell className="font-medium">{request.userEmail}</TableCell>
                          <TableCell>
                            <Badge className={roleColors[request.currentRole as UserRole]}>
                              {roleLabels[request.currentRole as UserRole]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={roleColors[request.requestedRole as UserRole]}>
                              {roleLabels[request.requestedRole as UserRole]}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-muted-foreground">
                            {request.reason || "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(request.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="bg-success hover:bg-success/90"
                                onClick={() =>
                                  resolveRequestMutation.mutate({ id: request.id, status: "approved" })
                                }
                                disabled={resolveRequestMutation.isPending}
                                data-testid={`button-approve-${request.id}`}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  resolveRequestMutation.mutate({ id: request.id, status: "denied" })
                                }
                                disabled={resolveRequestMutation.isPending}
                                data-testid={`button-deny-${request.id}`}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Deny
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Resolved Requests */}
            {resolvedRequests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Request History</CardTitle>
                  <CardDescription>Previously resolved role requests.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Requested</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Resolved By</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resolvedRequests.slice(0, 10).map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{request.userEmail}</TableCell>
                          <TableCell>
                            <Badge className={roleColors[request.requestedRole as UserRole]}>
                              {roleLabels[request.requestedRole as UserRole]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {request.status === "approved" ? (
                              <Badge className="bg-success/20 text-success border-success/30">
                                Approved
                              </Badge>
                            ) : (
                              <Badge className="bg-destructive/20 text-destructive border-destructive/30">
                                Denied
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {request.resolvedBy || "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {request.resolvedAt
                              ? new Date(request.resolvedAt).toLocaleDateString()
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="ai-prompts">
          <AiPromptsManager />
        </TabsContent>

        <TabsContent value="settings">
          <AppSettingsManager />
        </TabsContent>

      </Tabs>
    </div>
  );
}

interface AiChatIntent {
  id: string;
  intentKey: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  isEnabled: string;
  sortOrder: number;
}

function AiPromptsManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const { data: intents = [], isLoading } = useQuery<AiChatIntent[]>({
    queryKey: ['/api/ai-chat/intents'],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AiChatIntent> }) => {
      const res = await apiRequest('PATCH', `/api/ai-chat/intents/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-chat/intents'] });
      toast({ title: 'Intent updated successfully' });
      setEditingId(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update intent', description: error.message, variant: 'destructive' });
    },
  });

  const startEditing = (intent: AiChatIntent) => {
    setEditingId(intent.id);
    setEditPrompt(intent.systemPrompt);
    setEditDescription(intent.description || '');
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateMutation.mutate({
      id: editingId,
      updates: { systemPrompt: editPrompt, description: editDescription },
    });
  };

  const toggleEnabled = (intent: AiChatIntent) => {
    updateMutation.mutate({
      id: intent.id,
      updates: { isEnabled: intent.isEnabled === 'true' ? 'false' : 'true' },
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-sm">Loading AI intents...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Chat Intent Prompts</CardTitle>
        <CardDescription>
          Configure system prompts for each AI chat intent. These prompts control how the AI assistant responds to different types of questions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {intents.map((intent) => (
          <Card key={intent.id} data-testid={`card-intent-${intent.intentKey}`}>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm" data-testid={`text-intent-name-${intent.intentKey}`}>
                    {intent.name}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{intent.intentKey}</Badge>
                </div>
                {editingId !== intent.id && (
                  <p className="text-xs text-muted-foreground mt-1">{intent.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  data-testid={`switch-intent-${intent.intentKey}`}
                  checked={intent.isEnabled === 'true'}
                  onCheckedChange={() => toggleEnabled(intent)}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {editingId === intent.id ? (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <Input
                      data-testid={`input-intent-description-${intent.intentKey}`}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">System Prompt</Label>
                    <Textarea
                      data-testid={`textarea-intent-prompt-${intent.intentKey}`}
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      className="mt-1 text-sm font-mono min-h-[150px]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      data-testid={`button-save-intent-${intent.intentKey}`}
                      size="sm"
                      onClick={saveEdit}
                      disabled={updateMutation.isPending}
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                    <Button
                      data-testid={`button-cancel-intent-${intent.intentKey}`}
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <pre className="text-xs text-muted-foreground bg-muted rounded-md p-2 whitespace-pre-wrap max-h-[120px] overflow-y-auto">
                    {intent.systemPrompt}
                  </pre>
                  <Button
                    data-testid={`button-edit-intent-${intent.intentKey}`}
                    size="sm"
                    variant="ghost"
                    onClick={() => startEditing(intent)}
                    className="mt-2"
                  >
                    Edit Prompt
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}

function AppSettingsManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: autoArchiveSetting, isLoading } = useQuery<{ key: string; value: string | null }>({
    queryKey: ['/api/settings', 'auto_archive_enabled'],
  });

  const autoArchiveEnabled = autoArchiveSetting?.value !== 'false';

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest('PUT', '/api/settings/auto_archive_enabled', { value: enabled ? 'true' : 'false' });
      return res.json();
    },
    onSuccess: (_data, enabled) => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings', 'auto_archive_enabled'] });
      toast({
        title: enabled ? 'Auto-Archive Enabled' : 'Auto-Archive Disabled',
        description: enabled
          ? 'Weekly reports will be automatically archived on schedule.'
          : 'Auto-archiving is disabled. Use Force Archive or the API to archive reports manually.',
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update setting', description: error.message, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-sm">Loading settings...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Settings</CardTitle>
        <CardDescription>
          Configure system-wide settings for the dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start justify-between gap-4 p-4 rounded-md border">
          <div className="flex items-start gap-3 flex-1">
            <Archive className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div className="space-y-1">
              <div className="font-medium text-sm" data-testid="text-auto-archive-label">Auto-Archive Weekly Reports</div>
              <p className="text-xs text-muted-foreground">
                When enabled, weekly reports will be automatically archived on Wednesday 00:00 UTC
                if reports from the previous week are still unarchived. When disabled, reports will
                only be archived through the Force Archive button or the scheduler API.
              </p>
              <Badge
                variant="outline"
                className={autoArchiveEnabled
                  ? "bg-green-500/10 text-green-600 border-green-500/30"
                  : "bg-orange-500/10 text-orange-600 border-orange-500/30"
                }
                data-testid="badge-auto-archive-status"
              >
                {autoArchiveEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </div>
          <Switch
            data-testid="switch-auto-archive"
            checked={autoArchiveEnabled}
            onCheckedChange={(checked) => toggleMutation.mutate(checked)}
            disabled={toggleMutation.isPending}
          />
        </div>
      </CardContent>
    </Card>
  );
}
