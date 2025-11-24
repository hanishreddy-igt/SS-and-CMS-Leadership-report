import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, Clock, Briefcase, FileText, ClipboardList } from 'lucide-react';
import type { Project, WeeklyReport, ProjectLead } from '@shared/schema';

function getCurrentWeekStart(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysToMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

export default function ReportStatus() {
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ['/api/projects'] });
  const { data: weeklyReports = [] } = useQuery<WeeklyReport[]>({ queryKey: ['/api/weekly-reports'] });
  const { data: projectLeads = [] } = useQuery<ProjectLead[]>({ queryKey: ['/api/project-leads'] });
  
  const currentWeek = getCurrentWeekStart();
  const [filterLead, setFilterLead] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const currentWeekReports = weeklyReports.filter((r) => r.weekStart === currentWeek);

  const filteredProjects = projects.filter((project) => {
    if (filterLead !== 'all' && project.leadId !== filterLead) return false;
    
    const hasSubmitted = currentWeekReports.some((r) => r.projectId === project.id);
    if (filterStatus === 'submitted' && !hasSubmitted) return false;
    if (filterStatus === 'pending' && hasSubmitted) return false;
    
    return true;
  });

  const totalProjects = filteredProjects.length;
  const submittedCount = filteredProjects.filter((p) =>
    currentWeekReports.some((r) => r.projectId === p.id)
  ).length;
  const pendingCount = totalProjects - submittedCount;

  const getLeadName = (leadId: string) => {
    return projectLeads.find((l) => l.id === leadId)?.name || 'Unknown';
  };

  const hasSubmitted = (projectId: string) => {
    return currentWeekReports.some((r) => r.projectId === projectId);
  };

  const groupedByLead = filteredProjects.reduce((acc, project) => {
    const leadName = getLeadName(project.leadId);
    if (!acc[leadName]) {
      acc[leadName] = [];
    }
    acc[leadName].push(project);
    return acc;
  }, {} as Record<string, Project[]>);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Projects</p>
                <p className="text-3xl font-bold" data-testid="text-total-projects">
                  {totalProjects}
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
                <p className="text-sm text-muted-foreground">Reports Submitted</p>
                <p className="text-3xl font-bold text-green-600" data-testid="text-submitted">
                  {submittedCount}
                </p>
              </div>
              <FileText className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Reports Pending</p>
                <p className="text-3xl font-bold text-amber-600" data-testid="text-pending">
                  {pendingCount}
                </p>
              </div>
              <ClipboardList className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">Report Status by Project</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Week starting: {currentWeek}</p>
            </div>
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
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-filter-status">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
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
