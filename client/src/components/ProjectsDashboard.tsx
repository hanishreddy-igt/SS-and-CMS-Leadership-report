import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Briefcase, Calendar } from 'lucide-react';
import type { Project, ProjectLead, TeamMember } from '@shared/schema';

interface ProjectsDashboardProps {
  projects: Project[];
  projectLeads: ProjectLead[];
  teamMembers: TeamMember[];
}

export default function ProjectsDashboard({
  projects,
  projectLeads,
  teamMembers,
}: ProjectsDashboardProps) {
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
          <CardTitle className="text-2xl">All Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((project) => (
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
