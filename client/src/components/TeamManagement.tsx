import { useState } from 'react';
import { Edit2, Trash2, Check, X, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { TeamMember, ProjectLead, FeedbackEntry } from '@shared/schema';

interface EligibleRecipient {
  id: string;
  name: string;
}

export default function TeamManagement() {
  const { toast } = useToast();
  const [newMember, setNewMember] = useState('');
  const [newLead, setNewLead] = useState('');
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  
  // Feedback state
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackRecipient, setFeedbackRecipient] = useState<{ id: string; name: string; type: 'to_lead' | 'to_member' } | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [viewFeedbackDialogOpen, setViewFeedbackDialogOpen] = useState(false);
  const [viewingFeedbackFor, setViewingFeedbackFor] = useState<{ id: string; name: string } | null>(null);

  const { data: teamMembers = [], isLoading: isLoadingMembers } = useQuery<TeamMember[]>({
    queryKey: ['/api/team-members'],
  });

  const { data: projectLeads = [], isLoading: isLoadingLeads } = useQuery<ProjectLead[]>({
    queryKey: ['/api/project-leads'],
  });

  // Get eligible recipients for feedback to leads (when current user is a team member)
  const { data: eligibleLeads } = useQuery<{ eligibleRecipients: EligibleRecipient[] }>({
    queryKey: ['/api/feedback/eligible-recipients', 'to_lead'],
    queryFn: async () => {
      const res = await fetch('/api/feedback/eligible-recipients?type=to_lead', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch eligible leads');
      return res.json();
    },
  });

  // Get eligible recipients for feedback to members (when current user is a lead)
  const { data: eligibleMembers } = useQuery<{ eligibleRecipients: EligibleRecipient[] }>({
    queryKey: ['/api/feedback/eligible-recipients', 'to_member'],
    queryFn: async () => {
      const res = await fetch('/api/feedback/eligible-recipients?type=to_member', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch eligible members');
      return res.json();
    },
  });

  // Get feedback for the person being viewed
  const { data: viewedFeedback = [] } = useQuery<FeedbackEntry[]>({
    queryKey: ['/api/feedback', viewingFeedbackFor?.id],
    queryFn: async () => {
      if (!viewingFeedbackFor) return [];
      const res = await fetch(`/api/feedback/${viewingFeedbackFor.id}`, { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 403) return []; // Not authorized to view
        throw new Error('Failed to fetch feedback');
      }
      return res.json();
    },
    enabled: !!viewingFeedbackFor,
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

  const submitFeedbackMutation = useMutation({
    mutationFn: async (data: { recipientId: string; feedbackType: string; feedbackText: string }) => {
      return await apiRequest('POST', '/api/feedback', data);
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Feedback submitted anonymously' });
      setFeedbackDialogOpen(false);
      setFeedbackRecipient(null);
      setFeedbackText('');
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to submit feedback',
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

  const openFeedbackDialog = (person: { id: string; name: string }, type: 'to_lead' | 'to_member') => {
    setFeedbackRecipient({ ...person, type });
    setFeedbackText('');
    setFeedbackDialogOpen(true);
  };

  const handleSubmitFeedback = () => {
    if (!feedbackRecipient || !feedbackText.trim()) return;
    submitFeedbackMutation.mutate({
      recipientId: feedbackRecipient.id,
      feedbackType: feedbackRecipient.type,
      feedbackText: feedbackText.trim(),
    });
  };

  const openViewFeedback = (person: { id: string; name: string }) => {
    setViewingFeedbackFor(person);
    setViewFeedbackDialogOpen(true);
  };

  // Check if a lead is eligible for feedback (user works with them)
  const isLeadEligible = (leadId: string) => {
    return eligibleLeads?.eligibleRecipients?.some(r => r.id === leadId) || false;
  };

  // Check if a member is eligible for feedback (user works with them)
  const isMemberEligible = (memberId: string) => {
    return eligibleMembers?.eligibleRecipients?.some(r => r.id === memberId) || false;
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
                    <div className="flex items-center gap-2">
                      <span data-testid={`text-member-${member.id}`} className="font-medium">
                        {member.name}
                      </span>
                      {isMemberEligible(member.id) && (
                        <Button
                          data-testid={`button-feedback-member-${member.id}`}
                          size="sm"
                          variant="outline"
                          onClick={() => openFeedbackDialog(member, 'to_member')}
                          className="text-xs h-7 px-2 text-primary"
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Give Feedback
                        </Button>
                      )}
                    </div>
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
                    <div className="flex items-center gap-2">
                      <span data-testid={`text-lead-${lead.id}`} className="font-medium">
                        {lead.name}
                      </span>
                      {isLeadEligible(lead.id) && (
                        <Button
                          data-testid={`button-feedback-lead-${lead.id}`}
                          size="sm"
                          variant="outline"
                          onClick={() => openFeedbackDialog(lead, 'to_lead')}
                          className="text-xs h-7 px-2 text-primary"
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Give Feedback
                        </Button>
                      )}
                    </div>
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

      {/* Feedback Submission Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-submit-feedback">
          <DialogHeader>
            <DialogTitle>
              Give Anonymous Feedback
            </DialogTitle>
            <DialogDescription>
              Your feedback will be submitted anonymously. {feedbackRecipient?.name} will not know who provided this feedback.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Feedback for: <span className="font-semibold">{feedbackRecipient?.name}</span></Label>
              <p className="text-sm text-muted-foreground">
                {feedbackRecipient?.type === 'to_lead' 
                  ? 'You are providing feedback to a Team Lead you work with.'
                  : 'You are providing feedback to a Team Member you work with.'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback-text">Your Feedback</Label>
              <Textarea
                id="feedback-text"
                data-testid="textarea-feedback"
                placeholder="Share your constructive feedback here..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFeedbackDialogOpen(false)}
              data-testid="button-cancel-feedback"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitFeedback}
              disabled={!feedbackText.trim() || submitFeedbackMutation.isPending}
              data-testid="button-submit-feedback"
            >
              {submitFeedbackMutation.isPending ? 'Submitting...' : 'Submit Anonymously'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Feedback Dialog */}
      <Dialog open={viewFeedbackDialogOpen} onOpenChange={setViewFeedbackDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-view-feedback">
          <DialogHeader>
            <DialogTitle>
              Feedback for {viewingFeedbackFor?.name}
            </DialogTitle>
            <DialogDescription>
              All feedback is anonymous - you cannot see who provided it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
            {viewedFeedback.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No feedback received yet.</p>
            ) : (
              viewedFeedback.map((feedback) => (
                <div key={feedback.id} className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <p className="text-sm">{feedback.feedbackText}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(feedback.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewFeedbackDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
