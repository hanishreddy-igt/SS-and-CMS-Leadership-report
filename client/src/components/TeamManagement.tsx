import { useState } from 'react';
import { Edit2, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { TeamMember, ProjectLead } from '@shared/schema';

export default function TeamManagement() {
  const { toast } = useToast();
  const [newMember, setNewMember] = useState('');
  const [newLead, setNewLead] = useState('');
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const { data: teamMembers = [], isLoading: isLoadingMembers } = useQuery<TeamMember[]>({
    queryKey: ['/api/team-members'],
  });

  const { data: projectLeads = [], isLoading: isLoadingLeads } = useQuery<ProjectLead[]>({
    queryKey: ['/api/project-leads'],
  });

  const createMemberMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest('POST', '/api/team-members', { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-members'] });
      toast({ title: 'Success', description: 'Team member added' });
      setNewMember('');
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to add team member',
        variant: 'destructive'
      });
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return await apiRequest('PATCH', `/api/team-members/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-members'] });
      toast({ title: 'Success', description: 'Team member updated' });
      setEditingMemberId(null);
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to update team member',
        variant: 'destructive'
      });
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/team-members/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-members'] });
      toast({ title: 'Success', description: 'Team member deleted' });
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to delete team member',
        variant: 'destructive'
      });
    },
  });

  const createLeadMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest('POST', '/api/project-leads', { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-leads'] });
      toast({ title: 'Success', description: 'Project lead added' });
      setNewLead('');
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to add project lead',
        variant: 'destructive'
      });
    },
  });

  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return await apiRequest('PATCH', `/api/project-leads/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-leads'] });
      toast({ title: 'Success', description: 'Project lead updated' });
      setEditingLeadId(null);
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to update project lead',
        variant: 'destructive'
      });
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/project-leads/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-leads'] });
      toast({ title: 'Success', description: 'Project lead deleted' });
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to delete project lead',
        variant: 'destructive'
      });
    },
  });

  const handleAddMember = () => {
    if (newMember.trim()) {
      createMemberMutation.mutate(newMember.trim());
    }
  };

  const handleAddLead = () => {
    if (newLead.trim()) {
      createLeadMutation.mutate(newLead.trim());
    }
  };

  const startEditMember = (member: TeamMember) => {
    setEditingMemberId(member.id);
    setEditValue(member.name);
  };

  const startEditLead = (lead: ProjectLead) => {
    setEditingLeadId(lead.id);
    setEditValue(lead.name);
  };

  const saveEditMember = (id: string) => {
    if (editValue.trim()) {
      updateMemberMutation.mutate({ id, name: editValue.trim() });
    }
  };

  const saveEditLead = (id: string) => {
    if (editValue.trim()) {
      updateLeadMutation.mutate({ id, name: editValue.trim() });
    }
  };

  if (isLoadingMembers || isLoadingLeads) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Team Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              data-testid="input-member-name"
              type="text"
              value={newMember}
              onChange={(e) => setNewMember(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddMember()}
              placeholder="Enter team member name"
              className="flex-1"
            />
            <Button
              data-testid="button-add-member"
              onClick={handleAddMember}
              disabled={createMemberMutation.isPending}
            >
              {createMemberMutation.isPending ? 'Adding...' : 'Add Member'}
            </Button>
          </div>
          <div className="space-y-2">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between bg-muted/50 p-3 rounded-md"
              >
                {editingMemberId === member.id ? (
                  <div className="flex-1 flex gap-2">
                    <Input
                      data-testid={`input-edit-member-${member.id}`}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      data-testid={`button-save-member-${member.id}`}
                      size="icon"
                      variant="ghost"
                      onClick={() => saveEditMember(member.id)}
                      disabled={updateMemberMutation.isPending}
                      className="text-green-600 hover:text-green-700"
                    >
                      <Check className="h-5 w-5" />
                    </Button>
                    <Button
                      data-testid={`button-cancel-member-${member.id}`}
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingMemberId(null)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span data-testid={`text-member-${member.id}`} className="font-medium">
                      {member.name}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        data-testid={`button-edit-member-${member.id}`}
                        size="icon"
                        variant="ghost"
                        onClick={() => startEditMember(member)}
                        className="text-primary hover:text-primary"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        data-testid={`button-delete-member-${member.id}`}
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMemberMutation.mutate(member.id)}
                        disabled={deleteMemberMutation.isPending}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Team Leads</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              data-testid="input-lead-name"
              type="text"
              value={newLead}
              onChange={(e) => setNewLead(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddLead()}
              placeholder="Enter team lead name"
              className="flex-1"
            />
            <Button
              data-testid="button-add-lead"
              onClick={handleAddLead}
              disabled={createLeadMutation.isPending}
            >
              {createLeadMutation.isPending ? 'Adding...' : 'Add Lead'}
            </Button>
          </div>
          <div className="space-y-2">
            {projectLeads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between bg-muted/50 p-3 rounded-md"
              >
                {editingLeadId === lead.id ? (
                  <div className="flex-1 flex gap-2">
                    <Input
                      data-testid={`input-edit-lead-${lead.id}`}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      data-testid={`button-save-lead-${lead.id}`}
                      size="icon"
                      variant="ghost"
                      onClick={() => saveEditLead(lead.id)}
                      disabled={updateLeadMutation.isPending}
                      className="text-green-600 hover:text-green-700"
                    >
                      <Check className="h-5 w-5" />
                    </Button>
                    <Button
                      data-testid={`button-cancel-lead-${lead.id}`}
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingLeadId(null)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span data-testid={`text-lead-${lead.id}`} className="font-medium">
                      {lead.name}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        data-testid={`button-edit-lead-${lead.id}`}
                        size="icon"
                        variant="ghost"
                        onClick={() => startEditLead(lead)}
                        className="text-primary hover:text-primary"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        data-testid={`button-delete-lead-${lead.id}`}
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteLeadMutation.mutate(lead.id)}
                        disabled={deleteLeadMutation.isPending}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
