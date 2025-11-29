import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { AlertCircle, AlertTriangle, CheckCircle2, Check, Clock, FileText, ClipboardList, Filter, X } from 'lucide-react';
import type { Project, ProjectLead, WeeklyReport, TeamMember, TeamMemberFeedback, InsertWeeklyReport } from '@shared/schema';

const healthStatusOptions = [
  { value: 'on-track', label: 'On Track', icon: CheckCircle2, color: 'text-green-600' },
  { value: 'at-risk', label: 'At Risk', icon: AlertTriangle, color: 'text-amber-600' },
  { value: 'critical', label: 'Critical', icon: AlertCircle, color: 'text-red-600' },
];

function getCurrentWeekStart(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysToMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

export default function SubmitReport() {
  const { toast } = useToast();
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ['/api/projects'] });
  const { data: projectLeads = [] } = useQuery<ProjectLead[]>({ queryKey: ['/api/project-leads'] });
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({ queryKey: ['/api/team-members'] });
  const { data: weeklyReports = [] } = useQuery<WeeklyReport[]>({ queryKey: ['/api/weekly-reports'] });
  
  const [selectedLead, setSelectedLead] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [healthStatus, setHealthStatus] = useState('');
  const [progress, setProgress] = useState('');
  const [challenges, setChallenges] = useState('');
  const [nextWeek, setNextWeek] = useState('');
  const [memberFeedback, setMemberFeedback] = useState<Record<string, string>>({});
  
  const [statusFilterLeads, setStatusFilterLeads] = useState<Set<string>>(new Set());
  const [statusFilterStatus, setStatusFilterStatus] = useState<string>('all');
  const [statusLeadSearch, setStatusLeadSearch] = useState('');

  const currentWeek = getCurrentWeekStart();
  const leadProjects = selectedLead
    ? projects.filter((p) => p.leadId === selectedLead)
    : [];

  const selectedProjectData = projects.find((p) => p.id === selectedProject);
  const projectTeamMembers = selectedProjectData
    ? teamMembers.filter((m) => selectedProjectData.teamMemberIds.includes(m.id))
    : [];

  const currentWeekReports = weeklyReports.filter((r) => r.weekStart === currentWeek);
  const totalProjects = projects.length;
  const submittedCount = projects.filter((p) =>
    currentWeekReports.some((r) => r.projectId === p.id)
  ).length;
  const pendingCount = totalProjects - submittedCount;

  const hasSubmittedForProject = (projectId: string) => {
    return weeklyReports.some(
      (r) => r.projectId === projectId && r.weekStart === currentWeek
    );
  };

  const filteredStatusProjects = projects.filter((project) => {
    if (statusFilterLeads.size > 0 && !statusFilterLeads.has(project.leadId)) return false;
    
    const hasSubmitted = currentWeekReports.some((r) => r.projectId === project.id);
    if (statusFilterStatus === 'submitted' && !hasSubmitted) return false;
    if (statusFilterStatus === 'pending' && hasSubmitted) return false;
    
    return true;
  });

  const getLeadName = (leadId: string) => {
    return projectLeads.find((l) => l.id === leadId)?.name || 'Unknown';
  };

  const hasSubmitted = (projectId: string) => {
    return currentWeekReports.some((r) => r.projectId === projectId);
  };

  const groupedByLead = filteredStatusProjects.reduce((acc, project) => {
    const leadName = getLeadName(project.leadId);
    if (!acc[leadName]) {
      acc[leadName] = [];
    }
    acc[leadName].push(project);
    return acc;
  }, {} as Record<string, Project[]>);

  const activeFilterCount = (statusFilterLeads.size > 0 ? 1 : 0) + (statusFilterStatus !== 'all' ? 1 : 0);

  const clearAllFilters = () => {
    setStatusFilterLeads(new Set());
    setStatusFilterStatus('all');
    setStatusLeadSearch('');
  };

  const toggleLeadFilter = (leadId: string) => {
    const newSet = new Set(statusFilterLeads);
    if (newSet.has(leadId)) {
      newSet.delete(leadId);
    } else {
      newSet.add(leadId);
    }
    setStatusFilterLeads(newSet);
  };

  const submitReportMutation = useMutation({
    mutationFn: async (report: InsertWeeklyReport) => {
      return await apiRequest('POST', '/api/weekly-reports', report);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/weekly-reports'] });
      toast({ 
        title: 'Success', 
        description: 'Weekly report submitted successfully' 
      });
      setSelectedProject('');
      setHealthStatus('');
      setProgress('');
      setChallenges('');
      setNextWeek('');
      setMemberFeedback({});
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to submit report',
        variant: 'destructive'
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProject && selectedLead && healthStatus && progress && nextWeek) {
      const feedback: TeamMemberFeedback[] = Object.entries(memberFeedback)
        .filter(([_, feedback]) => feedback.trim())
        .map(([memberId, feedback]) => ({ memberId, feedback }));

      submitReportMutation.mutate({
        projectId: selectedProject,
        leadId: selectedLead,
        weekStart: currentWeek,
        healthStatus,
        progress,
        challenges: challenges || null,
        nextWeek,
        teamMemberFeedback: feedback.length > 0 ? feedback : null,
      });
    }
  };

  const filteredLeadsForSearch = projectLeads.filter(lead =>
    lead.name.toLowerCase().includes(statusLeadSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Reports Submitted</p>
                <p className="text-3xl font-bold text-green-600" data-testid="text-submitted">
                  {submittedCount}/{totalProjects}
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
                  {pendingCount}/{totalProjects}
                </p>
              </div>
              <ClipboardList className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Submit Weekly Report</CardTitle>
          <p className="text-sm text-muted-foreground">Week starting: {currentWeek}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
            <div className="space-y-2">
              <Label htmlFor="lead">Select Project Lead <span className="text-red-500">*</span></Label>
              <Select value={selectedLead} onValueChange={setSelectedLead}>
                <SelectTrigger id="lead" data-testid="select-report-lead">
                  <SelectValue placeholder="Select your name" />
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

            {selectedLead && (
              <div className="space-y-2">
                <Label htmlFor="project">Select Project <span className="text-red-500">*</span></Label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger id="project" data-testid="select-report-project">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {leadProjects.map((project) => (
                      <SelectItem
                        key={project.id}
                        value={project.id}
                        disabled={hasSubmittedForProject(project.id)}
                      >
                        {project.name}
                        {hasSubmittedForProject(project.id) && ' (Already submitted)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedProject && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="health-status">Project Health Status <span className="text-red-500">*</span></Label>
                  <Select value={healthStatus} onValueChange={setHealthStatus}>
                    <SelectTrigger id="health-status" data-testid="select-health-status">
                      <SelectValue placeholder="Select health status" />
                    </SelectTrigger>
                    <SelectContent>
                      {healthStatusOptions.map((option) => {
                        const Icon = option.icon;
                        return (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <Icon className={`h-4 w-4 ${option.color}`} />
                              <span>{option.label}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="progress">Progress This Week <span className="text-red-500">*</span></Label>
                  <Textarea
                    id="progress"
                    data-testid="textarea-progress"
                    value={progress}
                    onChange={(e) => setProgress(e.target.value)}
                    placeholder="Describe what was accomplished this week..."
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="challenges">Challenges & Blockers</Label>
                  <Textarea
                    id="challenges"
                    data-testid="textarea-challenges"
                    value={challenges}
                    onChange={(e) => setChallenges(e.target.value)}
                    placeholder="Describe any challenges or blockers..."
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="next-week">Plans for Next Week <span className="text-red-500">*</span></Label>
                  <Textarea
                    id="next-week"
                    data-testid="textarea-next-week"
                    value={nextWeek}
                    onChange={(e) => setNextWeek(e.target.value)}
                    placeholder="Outline plans for the upcoming week..."
                    rows={4}
                  />
                </div>

                {projectTeamMembers.length > 0 && (
                  <div className="space-y-3">
                    <Label>Team Member Feedback (Optional)</Label>
                    <div className="space-y-3 border rounded-md p-4">
                      {projectTeamMembers.map((member) => (
                        <div key={member.id} className="space-y-2">
                          <Label htmlFor={`feedback-${member.id}`} className="text-sm font-medium">
                            {member.name}
                          </Label>
                          <Textarea
                            id={`feedback-${member.id}`}
                            data-testid={`textarea-feedback-${member.id}`}
                            value={memberFeedback[member.id] || ''}
                            onChange={(e) =>
                              setMemberFeedback({ ...memberFeedback, [member.id]: e.target.value })
                            }
                            placeholder={`Feedback for ${member.name}...`}
                            rows={2}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button 
                  data-testid="button-submit-report" 
                  type="submit" 
                  className="w-full"
                  disabled={submitReportMutation.isPending}
                >
                  {submitReportMutation.isPending ? 'Submitting...' : 'Submit Report'}
                </Button>
              </>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">Report Status by Lead</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Week starting: {currentWeek}</p>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" data-testid="button-status-filter">
                  <Filter className="h-4 w-4" />
                  Filter
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72" align="end">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Filters</h4>
                    {activeFilterCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllFilters}
                        className="h-auto p-1 text-xs text-muted-foreground"
                        data-testid="button-clear-status-filters"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Clear all
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">By Lead</Label>
                    <Input
                      placeholder="Search leads..."
                      value={statusLeadSearch}
                      onChange={(e) => setStatusLeadSearch(e.target.value)}
                      className="h-8"
                      data-testid="input-status-lead-search"
                    />
                    <ScrollArea className="h-[140px]">
                      <div className="space-y-1">
                        {filteredLeadsForSearch.map((lead) => (
                          <div
                            key={lead.id}
                            className="flex items-center gap-2 p-1 hover-elevate rounded cursor-pointer"
                            onClick={() => toggleLeadFilter(lead.id)}
                          >
                            <Checkbox
                              checked={statusFilterLeads.has(lead.id)}
                              onCheckedChange={() => toggleLeadFilter(lead.id)}
                              data-testid={`checkbox-status-lead-${lead.id}`}
                            />
                            <span className="text-sm">{lead.name}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">By Status</Label>
                    <div className="space-y-1">
                      {[
                        { value: 'all', label: 'All Status' },
                        { value: 'submitted', label: 'Submitted' },
                        { value: 'pending', label: 'Pending' },
                      ].map((option) => (
                        <div
                          key={option.value}
                          className="flex items-center gap-2 p-1 hover-elevate rounded cursor-pointer"
                          onClick={() => setStatusFilterStatus(option.value)}
                        >
                          <Checkbox
                            checked={statusFilterStatus === option.value}
                            onCheckedChange={() => setStatusFilterStatus(option.value)}
                            data-testid={`checkbox-status-${option.value}`}
                          />
                          <span className="text-sm">{option.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.keys(groupedByLead).length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No projects found matching the filters.</p>
            ) : (
              Object.entries(groupedByLead).map(([leadName, leadProjects]) => {
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
                        const projectSubmitted = hasSubmitted(project.id);
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
                            {projectSubmitted ? (
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
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
