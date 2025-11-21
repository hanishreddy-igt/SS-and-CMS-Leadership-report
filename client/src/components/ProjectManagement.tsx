import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Search, X } from 'lucide-react';
import type { Project, ProjectLead, TeamMember } from '@shared/schema';

interface ProjectManagementProps {
  projects: Project[];
  projectLeads: ProjectLead[];
  teamMembers: TeamMember[];
  onAddProject: (project: Omit<Project, 'id'>) => void;
}

export default function ProjectManagement({
  projects,
  projectLeads,
  teamMembers,
  onAddProject,
}: ProjectManagementProps) {
  const [formData, setFormData] = useState({
    name: '',
    customer: '',
    leadId: '',
    teamMemberIds: [] as string[],
    startDate: '',
    endDate: '',
  });
  const [searchQuery, setSearchQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      formData.name &&
      formData.customer &&
      formData.leadId &&
      formData.teamMemberIds.length > 0 &&
      formData.startDate &&
      formData.endDate
    ) {
      onAddProject(formData);
      setFormData({
        name: '',
        customer: '',
        leadId: '',
        teamMemberIds: [],
        startDate: '',
        endDate: '',
      });
      setSearchQuery('');
    }
  };

  const toggleTeamMember = (memberId: string) => {
    setFormData((prev) => ({
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
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Add New Project</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                data-testid="input-project-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter project name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer">Customer</Label>
              <Input
                id="customer"
                data-testid="input-customer"
                type="text"
                value={formData.customer}
                onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                placeholder="Enter customer name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead">Project Lead</Label>
              <Select
                value={formData.leadId}
                onValueChange={(value) => setFormData({ ...formData, leadId: value })}
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
                {formData.teamMemberIds.length > 0 && (
                  <Badge variant="secondary" data-testid="badge-selected-count">
                    {formData.teamMemberIds.length} selected
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
                        checked={formData.teamMemberIds.includes(member.id)}
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
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  data-testid="input-end-date"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>

            <Button data-testid="button-add-project" type="submit" className="w-full">
              Add Project
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
