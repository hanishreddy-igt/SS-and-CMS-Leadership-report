import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, Clock } from 'lucide-react';
import type { Project, WeeklyReport, ProjectLead } from '@shared/schema';

interface ReportStatusProps {
  projects: Project[];
  weeklyReports: WeeklyReport[];
  projectLeads: ProjectLead[];
  getCurrentWeekStart: () => string;
}

export default function ReportStatus({
  projects,
  weeklyReports,
  projectLeads,
  getCurrentWeekStart,
}: ReportStatusProps) {
  const currentWeek = getCurrentWeekStart();

  const getLeadName = (leadId: string) => {
    return projectLeads.find((l) => l.id === leadId)?.name || 'Unknown';
  };

  const hasSubmitted = (projectId: string) => {
    return weeklyReports.some(
      (r) => r.projectId === projectId && r.weekStart === currentWeek
    );
  };

  const groupedByLead = projects.reduce((acc, project) => {
    const leadName = getLeadName(project.leadId);
    if (!acc[leadName]) {
      acc[leadName] = [];
    }
    acc[leadName].push(project);
    return acc;
  }, {} as Record<string, Project[]>);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Report Status</CardTitle>
          <p className="text-sm text-muted-foreground">Week starting: {currentWeek}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(groupedByLead).map(([leadName, leadProjects]) => {
              const submitted = leadProjects.filter((p) => hasSubmitted(p.id)).length;
              const total = leadProjects.length;
              const isComplete = submitted === total;

              return (
                <div key={leadName} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{leadName}</h3>
                    <Badge
                      variant={isComplete ? 'default' : 'secondary'}
                      data-testid={`badge-status-${leadName}`}
                    >
                      {submitted}/{total} submitted
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {leadProjects.map((project) => {
                      const submitted = hasSubmitted(project.id);
                      return (
                        <div
                          key={project.id}
                          className="flex items-center justify-between border rounded-md p-3"
                          data-testid={`status-${project.id}`}
                        >
                          <div className="flex-1">
                            <p className="font-medium">{project.name}</p>
                            <p className="text-sm text-muted-foreground">{project.customer}</p>
                          </div>
                          {submitted ? (
                            <div className="flex items-center gap-2 text-green-600">
                              <Check className="h-5 w-5" />
                              <span className="text-sm font-medium">Submitted</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-amber-600">
                              <Clock className="h-5 w-5" />
                              <span className="text-sm font-medium">Pending</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
