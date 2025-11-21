import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Briefcase, Calendar, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Project, ProjectLead, TeamMember } from '@shared/schema';

interface ProjectsDashboardProps {
  projects: Project[];
  projectLeads: ProjectLead[];
  teamMembers: TeamMember[];
}

type SortOrder = 'asc' | 'desc';

export default function ProjectsDashboard({
  projects,
  projectLeads,
  teamMembers,
}: ProjectsDashboardProps) {
  const [filterLead, setFilterLead] = useState<string>('all');
  const [filterMember, setFilterMember] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const totalTeamMembers = teamMembers.length;
  const totalLeads = projectLeads.length;

  const getLeadName = (leadId: string) => {
    return projectLeads.find((l) => l.id === leadId)?.name || 'Unknown';
  };

  const getTeamMemberNames = (memberIds: string[]) => {
    return memberIds
      .map((id) => teamMembers.find((m) => m.id === id)?.name)
      .filter(Boolean);
  };

  const filteredProjects = projects.filter((project) => {
    if (filterLead !== 'all' && project.leadId !== filterLead) return false;
    if (filterMember !== 'all' && !project.teamMemberIds.includes(filterMember)) return false;
    return true;
  });

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    const dateA = new Date(a.endDate).getTime();
    const dateB = new Date(b.endDate).getTime();
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  });

  const toggleSort = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Projects</p>
                <p className="text-3xl font-bold" data-testid="text-total-projects">
                  {projects.length}
                </p>
              </div>
              <Briefcase className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Team Members</p>
                <p className="text-3xl font-bold" data-testid="text-total-members">
                  {totalTeamMembers}
                </p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Project Leads</p>
                <p className="text-3xl font-bold" data-testid="text-total-leads">
                  {totalLeads}
                </p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-2xl">All Projects ({sortedProjects.length})</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={filterLead} onValueChange={setFilterLead}>
                <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-filter-lead">
                  <SelectValue placeholder="Filter by lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Leads</SelectItem>
                  {projectLeads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterMember} onValueChange={setFilterMember}>
                <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-filter-member">
                  <SelectValue placeholder="Filter by member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={toggleSort}
                data-testid="button-sort-date"
                className="gap-2"
              >
                <ArrowUpDown className="h-4 w-4" />
                End Date {sortOrder === 'asc' ? '↑' : '↓'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedProjects.map((project) => (
              <Card key={project.id} data-testid={`project-card-${project.id}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl">{project.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{project.customer}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Lead:</span>
                    <span className="text-muted-foreground">{getLeadName(project.leadId)}</span>
                  </div>

                  <div className="flex items-start gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <span className="font-medium">Team:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {getTeamMemberNames(project.teamMemberIds).map((name, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {project.startDate} - {project.endDate}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
