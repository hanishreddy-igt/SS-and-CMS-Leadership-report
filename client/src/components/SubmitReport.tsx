import { useState, useEffect } from 'react';
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
import { AlertCircle, AlertTriangle, CheckCircle2, Check, Clock, FileText, ClipboardList, Filter, X, Save, PenLine } from 'lucide-react';
import type { Project, ProjectLead, WeeklyReport, TeamMember, TeamMemberFeedback, InsertWeeklyReport } from '@shared/schema';

const healthStatusOptions = [
  { value: 'on-track', label: 'On Track', icon: CheckCircle2, color: 'text-success' },
  { value: 'at-risk', label: 'Needs Attention', icon: AlertTriangle, color: 'text-warning' },
  { value: 'critical', label: 'Critical', icon: AlertCircle, color: 'text-destructive' },
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
  const [existingDraftId, setExistingDraftId] = useState<string | null>(null);
  
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
  
  const isProjectEndedCheck = (endDate: string | null | undefined) => {
    if (!endDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const projectEndDate = new Date(endDate);
    return projectEndDate < today;
  };
  
  const activeProjects = projects.filter((p) => !isProjectEndedCheck(p.endDate));
  const totalProjects = activeProjects.length;
  const submittedCount = activeProjects.filter((p) =>
    currentWeekReports.some((r) => r.projectId === p.id && r.status === 'submitted')
  ).length;
  const pendingCount = totalProjects - submittedCount;

  const hasSubmittedForProject = (projectId: string) => {
    return weeklyReports.some(
      (r) => r.projectId === projectId && r.weekStart === currentWeek && r.status === 'submitted'
    );
  };

  const getDraftForProject = (projectId: string) => {
    return weeklyReports.find(
      (r) => r.projectId === projectId && r.weekStart === currentWeek && r.status === 'draft'
    );
  };

  const hasDraftForProject = (projectId: string) => {
    return weeklyReports.some(
      (r) => r.projectId === projectId && r.weekStart === currentWeek && r.status === 'draft'
    );
  };

  const hasLeadSubmittedAllReports = (leadId: string) => {
    const leadsProjects = projects.filter((p) => p.leadId === leadId);
    if (leadsProjects.length === 0) return false;
    return leadsProjects.every((p) => hasSubmittedForProject(p.id));
  };

  const isProjectEnded = (endDate: string | null | undefined) => {
    if (!endDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const projectEndDate = new Date(endDate);
    return projectEndDate < today;
  };

  useEffect(() => {
    if (selectedProject) {
      const draft = getDraftForProject(selectedProject);
      if (draft) {
        setExistingDraftId(draft.id);
        setHealthStatus(draft.healthStatus || '');
        setProgress(draft.progress || '');
        setChallenges(draft.challenges || '');
        setNextWeek(draft.nextWeek || '');
        if (draft.teamMemberFeedback && Array.isArray(draft.teamMemberFeedback)) {
          const feedbackMap: Record<string, string> = {};
          (draft.teamMemberFeedback as TeamMemberFeedback[]).forEach((fb) => {
            feedbackMap[fb.memberId] = fb.feedback;
          });
          setMemberFeedback(feedbackMap);
        }
      } else {
        setExistingDraftId(null);
        setHealthStatus('');
        setProgress('');
        setChallenges('');
        setNextWeek('');
        setMemberFeedback({});
      }
    }
  }, [selectedProject, weeklyReports]);

  const getProjectReportStatus = (projectId: string): 'submitted' | 'drafted' | 'pending' => {
    const report = currentWeekReports.find((r) => r.projectId === projectId);
    if (!report) return 'pending';
    return report.status === 'submitted' ? 'submitted' : 'drafted';
  };

  const filteredStatusProjects = projects.filter((project) => {
    // Exclude ended projects from the status list
    if (isProjectEndedCheck(project.endDate)) return false;
    
    if (statusFilterLeads.size > 0 && !statusFilterLeads.has(project.leadId)) return false;
    
    const reportStatus = getProjectReportStatus(project.id);
    if (statusFilterStatus === 'submitted' && reportStatus !== 'submitted') return false;
    if (statusFilterStatus === 'drafted' && reportStatus !== 'drafted') return false;
    if (statusFilterStatus === 'pending' && reportStatus !== 'pending') return false;
    // 'awaiting' means pending OR drafted (not submitted yet)
    if (statusFilterStatus === 'awaiting' && reportStatus === 'submitted') return false;
    
    return true;
  });

  const getLeadName = (leadId: string) => {
    return projectLeads.find((l) => l.id === leadId)?.name || 'Unknown';
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

  const saveDraftMutation = useMutation({
    mutationFn: async ({ report, isUpdate }: { report: InsertWeeklyReport; isUpdate: boolean }) => {
      if (isUpdate && existingDraftId) {
        return await apiRequest('PATCH', `/api/weekly-reports/${existingDraftId}`, report);
      }
      return await apiRequest('POST', '/api/weekly-reports', report);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/weekly-reports'] });
      toast({ 
        title: 'Draft Saved', 
        description: 'Your report has been saved as a draft' 
      });
      setSelectedProject('');
      setHealthStatus('');
      setProgress('');
      setChallenges('');
      setNextWeek('');
      setMemberFeedback({});
      setExistingDraftId(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to save draft',
        variant: 'destructive'
      });
    }
  });

  const submitReportMutation = useMutation({
    mutationFn: async ({ report, isUpdate }: { report: InsertWeeklyReport; isUpdate: boolean }) => {
      if (isUpdate && existingDraftId) {
        return await apiRequest('PATCH', `/api/weekly-reports/${existingDraftId}`, report);
      }
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
      setExistingDraftId(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to submit report',
        variant: 'destructive'
      });
    }
  });

  const buildReportData = (status: 'draft' | 'submitted'): InsertWeeklyReport => {
    const feedback: TeamMemberFeedback[] = Object.entries(memberFeedback)
      .filter(([_, feedback]) => feedback.trim())
      .map(([memberId, feedback]) => ({ memberId, feedback }));

    return {
      projectId: selectedProject,
      leadId: selectedLead,
      weekStart: currentWeek,
      healthStatus: healthStatus || null,
      progress: progress || null,
      challenges: challenges || null,
      nextWeek: nextWeek || null,
      teamMemberFeedback: feedback.length > 0 ? feedback : null,
      status,
    };
  };

  const handleSaveDraft = () => {
    if (selectedProject && selectedLead) {
      const report = buildReportData('draft');
      saveDraftMutation.mutate({ report, isUpdate: !!existingDraftId });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProject && selectedLead && healthStatus && progress && nextWeek) {
      const report = buildReportData('submitted');
      submitReportMutation.mutate({ report, isUpdate: !!existingDraftId });
    }
  };

  const canSaveDraft = selectedProject && selectedLead;
  const canSubmit = selectedProject && selectedLead && healthStatus && progress && nextWeek;

  const filteredLeadsForSearch = projectLeads.filter(lead =>
    lead.name.toLowerCase().includes(statusLeadSearch.toLowerCase())
  );

  // Tile click handlers - toggle filter and scroll to Report Status section
  const handleSubmittedTileClick = () => {
    // Clear lead filters first
    setStatusFilterLeads(new Set());
    setStatusLeadSearch('');
    
    // Toggle: if already filtered to 'submitted', clear it; otherwise apply it
    if (statusFilterStatus === 'submitted') {
      setStatusFilterStatus('all');
    } else {
      setStatusFilterStatus('submitted');
    }
    
    setTimeout(() => {
      const statusSection = document.getElementById('report-status-section');
      if (statusSection) {
        statusSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handlePendingTileClick = () => {
    // Clear lead filters first
    setStatusFilterLeads(new Set());
    setStatusLeadSearch('');
    
    // Toggle: if already filtered to 'awaiting' (pending + drafted), clear it; otherwise apply it
    if (statusFilterStatus === 'awaiting') {
      setStatusFilterStatus('all');
    } else {
      setStatusFilterStatus('awaiting');
    }
    
    setTimeout(() => {
      const statusSection = document.getElementById('report-status-section');
      if (statusSection) {
        statusSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  return (
    <div className="space-y-8">
      {/* Premium Metric Cards - Clickable to filter Report Status section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div 
          className={`glass-card rounded-xl p-6 cursor-pointer transition-all hover:border-success/30 ${statusFilterStatus === 'submitted' ? 'border-success/50 ring-1 ring-success/20' : ''}`}
          onClick={handleSubmittedTileClick}
          data-testid="tile-submitted-reports"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="section-label">Weekly Progress</p>
              <p className="text-3xl font-bold tabular-nums" data-testid="text-submitted">
                <span className="text-success">{submittedCount}</span>
                <span className="text-muted-foreground text-lg">/{totalProjects}</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">Reports Submitted</p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-success/10 flex items-center justify-center">
              <FileText className="h-7 w-7 text-success" />
            </div>
          </div>
          <div className="mt-4 h-2 bg-muted/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-success transition-all duration-500"
              style={{ width: `${totalProjects ? (submittedCount / totalProjects) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div 
          className={`glass-card rounded-xl p-6 cursor-pointer transition-all hover:border-warning/30 ${statusFilterStatus === 'awaiting' ? 'border-warning/50 ring-1 ring-warning/20' : ''}`}
          onClick={handlePendingTileClick}
          data-testid="tile-pending-reports"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="section-label">Awaiting Submission</p>
              <p className="text-3xl font-bold tabular-nums" data-testid="text-pending">
                <span className="text-warning">{pendingCount}</span>
                <span className="text-muted-foreground text-lg">/{totalProjects}</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">Reports Pending</p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-warning/10 flex items-center justify-center">
              <ClipboardList className="h-7 w-7 text-warning" />
            </div>
          </div>
          <div className="mt-4 h-2 bg-muted/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-warning transition-all duration-500"
              style={{ width: `${totalProjects ? (pendingCount / totalProjects) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      <Card className="glass-card border-white/10">
        <CardHeader className="border-b border-white/5">
          <div>
            <p className="section-label">Weekly Submission</p>
            <CardTitle className="text-2xl">Submit Weekly Report</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Week starting: <span className="text-primary font-medium">{currentWeek}</span></p>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
            <div className="space-y-2">
              <Label htmlFor="lead">Select Project Lead <span className="text-red-500">*</span></Label>
              <Select 
                value={selectedLead} 
                onValueChange={(value) => {
                  if (value === '__none__') {
                    setSelectedLead('');
                    setSelectedProject('');
                    setHealthStatus('');
                    setProgress('');
                    setChallenges('');
                    setNextWeek('');
                    setMemberFeedback({});
                    setExistingDraftId(null);
                  } else {
                    setSelectedLead(value);
                  }
                }}
              >
                <SelectTrigger id="lead" data-testid="select-report-lead">
                  <SelectValue placeholder="Select your name" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">--</SelectItem>
                  {projectLeads.map((lead) => {
                    const allSubmitted = hasLeadSubmittedAllReports(lead.id);
                    return (
                      <SelectItem 
                        key={lead.id} 
                        value={lead.id}
                        disabled={allSubmitted}
                      >
                        <span className="flex items-center gap-1">
                          {lead.name}
                          {allSubmitted && <span className="font-bold text-red-600">(Submitted all reports)</span>}
                        </span>
                      </SelectItem>
                    );
                  })}
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
                    {leadProjects
                      .filter((project) => !isProjectEnded(project.endDate))
                      .map((project) => {
                        const isSubmitted = hasSubmittedForProject(project.id);
                        const isDrafted = hasDraftForProject(project.id);
                        return (
                          <SelectItem
                            key={project.id}
                            value={project.id}
                            disabled={isSubmitted}
                          >
                            <span className="flex items-center gap-1">
                              <span className={isSubmitted ? 'line-through' : ''}>{project.name}</span>
                              {isSubmitted && <span className="font-bold text-red-600">(Already submitted)</span>}
                              {isDrafted && !isSubmitted && <span className="font-bold text-red-600">(Drafted)</span>}
                            </span>
                          </SelectItem>
                        );
                      })}
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

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    data-testid="button-cancel"
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelectedProject('');
                      setHealthStatus('');
                      setProgress('');
                      setChallenges('');
                      setNextWeek('');
                      setMemberFeedback({});
                      setExistingDraftId(null);
                    }}
                  >
                    Cancel
                  </Button>
                  {canSubmit ? (
                    <Button 
                      data-testid="button-submit-report" 
                      type="submit" 
                      className="flex-1"
                      disabled={submitReportMutation.isPending}
                    >
                      {submitReportMutation.isPending ? 'Submitting...' : 'Submit Report'}
                    </Button>
                  ) : (
                    <Button 
                      data-testid="button-save-draft" 
                      type="button"
                      className="flex-1"
                      disabled={!canSaveDraft || saveDraftMutation.isPending}
                      onClick={handleSaveDraft}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saveDraftMutation.isPending ? 'Saving...' : existingDraftId ? 'Update Draft' : 'Save as Draft'}
                    </Button>
                  )}
                </div>
              </>
            )}
          </form>
        </CardContent>
      </Card>

      <Card id="report-status-section" className="glass-card border-white/10">
        <CardHeader className="border-b border-white/5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="section-label">Status Overview</p>
              <CardTitle className="text-2xl">Report Status by Lead</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Week starting: <span className="text-primary font-medium">{currentWeek}</span></p>
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
                    <ScrollArea className="h-[160px] scrollbar-visible">
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
                        { value: 'drafted', label: 'Drafted' },
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
                const submitted = leadProjects.filter((p) => getProjectReportStatus(p.id) === 'submitted').length;
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
                        const reportStatus = getProjectReportStatus(project.id);
                        return (
                          <div
                            key={project.id}
                            className="flex items-center justify-between bg-muted/30 border border-white/10 rounded-lg p-4 transition-all hover:bg-muted/50"
                            data-testid={`status-${project.id}`}
                          >
                            <div className="flex-1">
                              <p className="font-medium">{project.name}</p>
                              <p className="text-sm text-muted-foreground">{project.customer}</p>
                            </div>
                            {reportStatus === 'submitted' ? (
                              <div className="flex items-center gap-2 text-success">
                                <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
                                  <Check className="h-4 w-4" />
                                </div>
                                <span className="text-sm font-medium">Submitted</span>
                              </div>
                            ) : reportStatus === 'drafted' ? (
                              <div className="flex items-center gap-2 text-primary">
                                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <PenLine className="h-4 w-4" />
                                </div>
                                <span className="text-sm font-medium">Drafted</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-warning">
                                <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center">
                                  <Clock className="h-4 w-4" />
                                </div>
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
