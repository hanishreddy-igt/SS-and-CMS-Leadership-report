import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Search, X } from 'lucide-react';
import type { ProjectLead, TeamMember, InsertProject } from '@shared/schema';

export default function TeamAndProjectManagement() {
  const { toast } = useToast();
  const { data: projectLeads = [] } = useQuery<ProjectLead[]>({ queryKey: ['/api/project-leads'] });
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({ queryKey: ['/api/team-members'] });
  
  // Team member state
  const [newMember, setNewMember] = useState('');
  
  // Project lead state
  const [newLead, setNewLead] = useState('');
  
  // Project state
  const [projectFormData, setProjectFormData] = useState({
    name: '',
    customer: '',
    leadId: '',
    teamMemberIds: [] as string[],
    startDate: '',
    endDate: '',
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Team member mutations
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

  // Project lead mutations
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

  // Project mutations
  const createProjectMutation = useMutation({
    mutationFn: async (project: InsertProject) => {
      return await apiRequest('POST', '/api/projects', project);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ 
        title: 'Success', 
        description: 'Project created successfully' 
      });
      setProjectFormData({
        name: '',
        customer: '',
        leadId: '',
        teamMemberIds: [],
        startDate: '',
        endDate: '',
      });
      setSearchQuery('');
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to create project',
        variant: 'destructive'
      });
    }
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

  const handleSubmitProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      projectFormData.name &&
      projectFormData.customer &&
      projectFormData.leadId &&
      projectFormData.teamMemberIds.length > 0 &&
      projectFormData.startDate &&
      projectFormData.endDate
    ) {
      createProjectMutation.mutate(projectFormData);
    }
  };

  const toggleTeamMember = (memberId: string) => {
    setProjectFormData((prev) => ({
      ...prev,
      teamMemberIds: prev.teamMemberIds.includes(memberId)
        ? prev.teamMemberIds.filter((id) => id !== memberId)
        : [...prev.teamMemberIds, memberId],
    }));
  };

  const filteredTeamMembers = teamMembers.filter((member) =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const clearSearch = () => {
    setSearchQuery('');
  };

  return (
    <div className="space-y-6">
      {/* Add Team Member */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Add Team Member</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 max-w-2xl">
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
        </CardContent>
      </Card>

      {/* Add Project Lead */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Add Project Lead</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 max-w-2xl">
            <Input
              data-testid="input-lead-name"
              type="text"
              value={newLead}
              onChange={(e) => setNewLead(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddLead()}
              placeholder="Enter project lead name"
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
        </CardContent>
      </Card>

      {/* Add New Project */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Add New Project</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitProject} className="space-y-4 max-w-2xl">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                data-testid="input-project-name"
                type="text"
                value={projectFormData.name}
                onChange={(e) => setProjectFormData({ ...projectFormData, name: e.target.value })}
                placeholder="Enter project name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer">Customer</Label>
              <Input
                id="customer"
                data-testid="input-customer"
                type="text"
                value={projectFormData.customer}
                onChange={(e) => setProjectFormData({ ...projectFormData, customer: e.target.value })}
                placeholder="Enter customer name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead">Project Lead</Label>
              <Select
                value={projectFormData.leadId}
                onValueChange={(value) => setProjectFormData({ ...projectFormData, leadId: value })}
              >
                <SelectTrigger id="lead" data-testid="select-lead">
                  <SelectValue placeholder="Select project lead" />
                </SelectTrigger>
                <SelectContent>
                  {projectLeads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Team Members</Label>
                {projectFormData.teamMemberIds.length > 0 && (
                  <Badge variant="secondary" data-testid="badge-selected-count">
                    {projectFormData.teamMemberIds.length} selected
                  </Badge>
                )}
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search team members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9"
                  data-testid="input-search-members"
                />
                {searchQuery && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={clearSearch}
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                    data-testid="button-clear-search"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="border rounded-md p-4 space-y-2 max-h-64 overflow-y-auto">
                {filteredTeamMembers.length > 0 ? (
                  filteredTeamMembers.map((member) => (
                    <div key={member.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`member-${member.id}`}
                        data-testid={`checkbox-member-${member.id}`}
                        checked={projectFormData.teamMemberIds.includes(member.id)}
                        onCheckedChange={() => toggleTeamMember(member.id)}
                      />
                      <Label htmlFor={`member-${member.id}`} className="font-normal cursor-pointer">
                        {member.name}
                      </Label>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-results">
                    No team members found matching "{searchQuery}"
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  data-testid="input-start-date"
                  type="date"
                  value={projectFormData.startDate}
                  onChange={(e) => setProjectFormData({ ...projectFormData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  data-testid="input-end-date"
                  type="date"
                  value={projectFormData.endDate}
                  onChange={(e) => setProjectFormData({ ...projectFormData, endDate: e.target.value })}
                />
              </div>
            </div>

            <Button 
              data-testid="button-add-project" 
              type="submit" 
              className="w-full"
              disabled={createProjectMutation.isPending}
            >
              {createProjectMutation.isPending ? 'Adding...' : 'Add Project'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
