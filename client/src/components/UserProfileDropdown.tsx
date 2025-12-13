import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, usePermissions, UserRole } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { User, Settings, Shield, ArrowRightLeft, LogOut, Send, LayoutGrid } from "lucide-react";
import { useLocation } from "wouter";

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

export function UserProfileDropdown() {
  const { user, role, actualRole, isRoleOverridden, isAdmin } = useAuth();
  const { canManageUsers } = usePermissions();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showRoleRequestDialog, setShowRoleRequestDialog] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [requestedRole, setRequestedRole] = useState<UserRole>("lead");
  const [requestReason, setRequestReason] = useState("");

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { displayName: string }) => {
      return apiRequest("PATCH", "/api/users/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Profile Updated", description: "Your display name has been updated." });
      setShowProfileDialog(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update profile.", variant: "destructive" });
    },
  });

  const switchRoleMutation = useMutation({
    mutationFn: async (newRole: string) => {
      return apiRequest("POST", "/api/users/switch-role", { role: newRole });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/effective-role"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Role Switched", description: "You are now viewing the app as a different role." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to switch role.", variant: "destructive" });
    },
  });

  const requestRoleMutation = useMutation({
    mutationFn: async (data: { requestedRole: string; reason: string }) => {
      return apiRequest("POST", "/api/role-requests", data);
    },
    onSuccess: () => {
      toast({ title: "Request Submitted", description: "Your role upgrade request has been submitted for review." });
      setShowRoleRequestDialog(false);
      setRequestReason("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit role request.", variant: "destructive" });
    },
  });

  const handleLogout = () => {
    window.location.href = "/api/auth/logout";
  };

  const displayEmail = user?.email || "Unknown";
  const displayNameValue = user?.displayName || user?.firstName || displayEmail.split("@")[0];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2" data-testid="button-user-profile">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="hidden sm:flex flex-col items-start">
              <span className="text-sm font-medium">{displayNameValue}</span>
              <div className="flex items-center gap-1">
                <Badge className={`text-[10px] px-1 py-0 h-4 ${roleColors[role]}`}>
                  {roleLabels[role]}
                </Badge>
                {isRoleOverridden && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                    Testing
                  </Badge>
                )}
              </div>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span>{displayNameValue}</span>
              <span className="text-xs font-normal text-muted-foreground">{displayEmail}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => setShowProfileDialog(true)} data-testid="menu-edit-profile">
            <Settings className="mr-2 h-4 w-4" />
            Edit Profile
          </DropdownMenuItem>

          {!isAdmin && (
            <DropdownMenuItem onClick={() => setShowRoleRequestDialog(true)} data-testid="menu-request-role">
              <Send className="mr-2 h-4 w-4" />
              Request Role Upgrade
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setLocation("/features")} data-testid="menu-feature-panel">
            <LayoutGrid className="mr-2 h-4 w-4" />
            Feature Panel
          </DropdownMenuItem>

          {canManageUsers && (
            <DropdownMenuItem onClick={() => setLocation("/admin")} data-testid="menu-admin-panel">
              <Shield className="mr-2 h-4 w-4" />
              Admin Panel
            </DropdownMenuItem>
          )}

          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Switch Role (Testing)
              </DropdownMenuLabel>
              {(['admin', 'manager', 'lead', 'member'] as UserRole[]).map((r) => (
                <DropdownMenuItem
                  key={r}
                  onClick={() => switchRoleMutation.mutate(r)}
                  className={role === r ? "bg-muted" : ""}
                  data-testid={`menu-switch-role-${r}`}
                >
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  View as {roleLabels[r]}
                  {role === r && <span className="ml-auto text-xs text-muted-foreground">Current</span>}
                </DropdownMenuItem>
              ))}
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-destructive" data-testid="menu-logout">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Profile Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update your display name. Your email cannot be changed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email (cannot be changed)</Label>
              <Input value={displayEmail} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your display name"
                data-testid="input-display-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <div className="flex items-center gap-2">
                <Badge className={roleColors[actualRole]}>{roleLabels[actualRole]}</Badge>
                <span className="text-xs text-muted-foreground">(assigned by admin)</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowProfileDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => updateProfileMutation.mutate({ displayName })}
                disabled={updateProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Request Role Upgrade Dialog */}
      <Dialog open={showRoleRequestDialog} onOpenChange={setShowRoleRequestDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Role Upgrade</DialogTitle>
            <DialogDescription>
              Submit a request to upgrade your role. An admin will review your request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Role</Label>
              <Badge className={roleColors[actualRole]}>{roleLabels[actualRole]}</Badge>
            </div>
            <div className="space-y-2">
              <Label htmlFor="requestedRole">Requested Role</Label>
              <Select value={requestedRole} onValueChange={(v) => setRequestedRole(v as UserRole)}>
                <SelectTrigger data-testid="select-requested-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {actualRole === 'member' && <SelectItem value="lead">Team Lead</SelectItem>}
                  {(actualRole === 'member' || actualRole === 'lead') && (
                    <SelectItem value="manager">Manager</SelectItem>
                  )}
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Request (optional)</Label>
              <Textarea
                id="reason"
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                placeholder="Explain why you need this role upgrade..."
                rows={3}
                data-testid="textarea-request-reason"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRoleRequestDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => requestRoleMutation.mutate({ requestedRole, reason: requestReason })}
                disabled={requestRoleMutation.isPending}
                data-testid="button-submit-request"
              >
                {requestRoleMutation.isPending ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
