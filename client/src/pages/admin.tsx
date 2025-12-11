import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, usePermissions, UserRole } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Shield, Users, Clock, CheckCircle, XCircle, ArrowLeft } from "lucide-react";

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
  member: "bg-gray-500/20 text-gray-600 border-gray-500/30",
};

const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  manager: "Manager",
  lead: "Team Lead",
  member: "Member",
};

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

  if (!canManageUsers) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Shield className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Access Denied</h1>
        <p className="text-muted-foreground">You don't have permission to access this page.</p>
        <Button onClick={() => setLocation("/")} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
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
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>View and manage user roles in the system.</CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading users...</div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No users found.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
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
                              <SelectItem value="lead">Team Lead</SelectItem>
                              <SelectItem value="member">Member</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
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
      </Tabs>
    </div>
  );
}
