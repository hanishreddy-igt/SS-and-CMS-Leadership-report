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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertCircle, AlertTriangle, CheckCircle2, Check, Clock, FileText, ClipboardList, Filter, X, Save, PenLine, Eye } from 'lucide-react';
import type { Project, ProjectLead, WeeklyReport, TeamMember, TeamMemberFeedback, InsertWeeklyReport, TeamMemberAssignment } from '@shared/schema';

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

  // Modal state for clicking on project tiles
  const [showReportModal, setShowReportModal] = useState(false);
  const [modalProject, setModalProject] = useState<Project | null>(null);
  const [modalHealthStatus, setModalHealthStatus] = useState('');
  const [modalProgress, setModalProgress] = useState('');
  const [modalChallenges, setModalChallenges] = useState('');
  const [modalNextWeek, setModalNextWeek] = useState('');
  const [modalMemberFeedback, setModalMemberFeedback] = useState<Record<string, string>>({});
  const [modalExistingDraftId, setModalExistingDraftId] = useState<string | null>(null);
  
  // Lock state for preventing simultaneous editing
  const [projectLockInfo, setProjectLockInfo] = useState<{ isLocked: boolean; lockedBy: string } | null>(null);

  const currentWeek = getCurrentWeekStart();
  
  // Helper to get all lead IDs for a project (supports co-leads)
  const getProjectLeadIds = (project: Project): string[] => {
    return project.leadIds && project.leadIds.length > 0 
      ? project.leadIds 
      : [project.leadId];
  };

  // Helper to check if a lead is assigned to a project (works with co-leads)
  const isLeadAssignedToProject = (project: Project, leadId: string): boolean => {
    const projectLeadIds = getProjectLeadIds(project);
    return projectLeadIds.includes(leadId);
  };
  
  const leadProjects = selectedLead
    ? projects.filter((p) => isLeadAssignedToProject(p, selectedLead))
    : [];

  const selectedProjectData = projects.find((p) => p.id === selectedProject);
  const projectMemberIds = selectedProjectData 
    ? ((selectedProjectData.teamMembers as TeamMemberAssignment[]) || []).map(a => a.memberId)
    : [];
  const projectTeamMembers = selectedProjectData
    ? teamMembers.filter((m) => projectMemberIds.includes(m.id))
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
    const leadsProjects = projects.filter((p) => isLeadAssignedToProject(p, leadId));
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

  // Get team members for a specific project
  const getProjectTeamMembers = (project: Project) => {
    const memberIds = ((project.teamMembers as TeamMemberAssignment[]) || []).map(a => a.memberId);
    return teamMembers.filter((m) => memberIds.includes(m.id));
  };

  // Handle clicking on a project tile in the Report Status section
  const handleProjectTileClick = async (project: Project) => {
    const reportStatus = getProjectReportStatus(project.id);
    
    // Check if someone else is editing this project
    try {
      const lockCheckResponse = await fetch(`/api/project-locks/${project.id}`, {
        credentials: 'include'
      });
      const lockCheck = await lockCheckResponse.json();
      
      if (lockCheck.isLocked) {
        // Someone else is editing - show warning but still allow opening
        setProjectLockInfo({ isLocked: true, lockedBy: lockCheck.lockedBy });
      } else {
        setProjectLockInfo(null);
        // Acquire lock for this project
        await apiRequest('POST', `/api/project-locks/${project.id}`, {});
      }
    } catch (error) {
      console.error('Error checking/acquiring lock:', error);
      setProjectLockInfo(null);
    }
    
    setModalProject(project);
    setShowReportModal(true);
    
    if (reportStatus === 'submitted') {
      // Just show the submitted message, no need to load form data
      return;
    }
    
    // Load draft data if exists
    const draft = getDraftForProject(project.id);
    if (draft) {
      setModalExistingDraftId(draft.id);
      setModalHealthStatus(draft.healthStatus || '');
      setModalProgress(draft.progress || '');
      setModalChallenges(draft.challenges || '');
      setModalNextWeek(draft.nextWeek || '');
      if (draft.teamMemberFeedback && Array.isArray(draft.teamMemberFeedback)) {
        const feedbackMap: Record<string, string> = {};
        (draft.teamMemberFeedback as TeamMemberFeedback[]).forEach((fb) => {
          feedbackMap[fb.memberId] = fb.feedback;
        });
        setModalMemberFeedback(feedbackMap);
      } else {
        setModalMemberFeedback({});
      }
    } else {
      // Reset form for new submission
      setModalExistingDraftId(null);
      setModalHealthStatus('');
      setModalProgress('');
      setModalChallenges('');
      setModalNextWeek('');
      setModalMemberFeedback({});
    }
  };

  // Close the modal and reset state
  const closeReportModal = async () => {
    // Release the lock when closing modal
    if (modalProject && !projectLockInfo?.isLocked) {
      try {
        await apiRequest('DELETE', `/api/project-locks/${modalProject.id}`, {});
      } catch (error) {
        console.error('Error releasing lock:', error);
      }
    }
    
    setShowReportModal(false);
    setModalProject(null);
    setModalHealthStatus('');
    setModalProgress('');
    setModalChallenges('');
    setModalNextWeek('');
    setModalMemberFeedback({});
    setModalExistingDraftId(null);
    setProjectLockInfo(null);
  };

  const filteredStatusProjects = projects.filter((project) => {
    // Exclude ended projects from the status list
    if (isProjectEndedCheck(project.endDate)) return false;
    
    // Check if any of the project's leads match the filter (supports co-leads)
    const projectLeadIds = getProjectLeadIds(project);
    if (statusFilterLeads.size > 0 && !projectLeadIds.some(leadId => statusFilterLeads.has(leadId))) return false;
    
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

  // Get all lead names for a project (for display with co-leads)
  const getProjectLeadNames = (project: Project): string => {
    const leadIds = getProjectLeadIds(project);
    const names = leadIds
      .map(id => projectLeads.find(l => l.id === id)?.name)
      .filter(Boolean) as string[];
    return names.join(' & ') || 'Unknown';
  };

  // Check if a project has co-leads
  const hasCoLeads = (project: Project): boolean => {
    return project.leadIds && project.leadIds.length > 1;
  };

  // Get the name of who submitted a report
  const getSubmittedByName = (projectId: string): string | null => {
    const report = currentWeekReports.find((r) => r.projectId === projectId && r.status === 'submitted');
    if (report && report.submittedByLeadId) {
      return getLeadName(report.submittedByLeadId);
    }
    return null;
  };

  // Group projects by lead - co-lead projects appear under each assigned lead
  const groupedByLead = filteredStatusProjects.reduce((acc, project) => {
    const projectLeadIds = getProjectLeadIds(project);
    projectLeadIds.forEach(leadId => {
      const leadName = getLeadName(leadId);
      if (!acc[leadName]) {
        acc[leadName] = [];
      }
      // Avoid duplicates if project was already added for this lead
      if (!acc[leadName].some(p => p.id === project.id)) {
        acc[leadName].push(project);
      }
    });
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
      submittedByLeadId: status === 'submitted' ? selectedLead : null,
    };
  };

  const handleSaveDraft = () => {
    if (selectedProject && selectedLead) {
      const report = buildReportData('draft');
      saveDraftMutation.mutate({ report, isUpdate: !!existingDraftId });
    }
  };

  // Modal-specific mutations
  const modalSaveDraftMutation = useMutation({
    mutationFn: async ({ report, isUpdate, draftId }: { report: InsertWeeklyReport; isUpdate: boolean; draftId: string | null }) => {
      if (isUpdate && draftId) {
        return await apiRequest('PATCH', `/api/weekly-reports/${draftId}`, report);
      }
      return await apiRequest('POST', '/api/weekly-reports', report);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/weekly-reports'] });
      toast({ 
        title: 'Draft Saved', 
        description: 'Your report has been saved as a draft' 
      });
      closeReportModal();
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to save draft',
        variant: 'destructive'
      });
    }
  });

  const modalSubmitReportMutation = useMutation({
    mutationFn: async ({ report, isUpdate, draftId }: { report: InsertWeeklyReport; isUpdate: boolean; draftId: string | null }) => {
      if (isUpdate && draftId) {
        return await apiRequest('PATCH', `/api/weekly-reports/${draftId}`, report);
      }
      return await apiRequest('POST', '/api/weekly-reports', report);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/weekly-reports'] });
      toast({ 
        title: 'Success', 
        description: 'Weekly report submitted successfully' 
      });
      closeReportModal();
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to submit report',
        variant: 'destructive'
      });
    }
  });

  // Build report data for modal
  const buildModalReportData = (status: 'draft' | 'submitted'): InsertWeeklyReport | null => {
    if (!modalProject) return null;
    
    const feedback: TeamMemberFeedback[] = Object.entries(modalMemberFeedback)
      .filter(([_, feedback]) => feedback.trim())
      .map(([memberId, feedback]) => ({ memberId, feedback }));

    // Get the primary lead ID from co-leads array or fallback to legacy leadId
    const projectLeadIds = getProjectLeadIds(modalProject);
    const primaryLeadId = projectLeadIds[0] || modalProject.leadId;

    return {
      projectId: modalProject.id,
      leadId: primaryLeadId, // Primary lead for the project (from leadIds array)
      weekStart: currentWeek,
      healthStatus: modalHealthStatus || null,
      progress: modalProgress || null,
      challenges: modalChallenges || null,
      nextWeek: modalNextWeek || null,
      teamMemberFeedback: feedback.length > 0 ? feedback : null,
      status,
      // Track who submitted the report (using primary lead for now - could be enhanced with actual logged-in user)
      submittedByLeadId: status === 'submitted' ? primaryLeadId : null,
    };
  };

  const handleModalSaveDraft = () => {
    const report = buildModalReportData('draft');
    if (report) {
      modalSaveDraftMutation.mutate({ report, isUpdate: !!modalExistingDraftId, draftId: modalExistingDraftId });
    }
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modalProject && modalHealthStatus && modalProgress && modalNextWeek) {
      const report = buildModalReportData('submitted');
      if (report) {
        modalSubmitReportMutation.mutate({ report, isUpdate: !!modalExistingDraftId, draftId: modalExistingDraftId });
      }
    }
  };

  const canModalSaveDraft = modalProject !== null;
  const canModalSubmit = modalProject && modalHealthStatus && modalProgress && modalNextWeek;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProject && selectedLead && healthStatus && progress && nextWeek) {
      const report = buildReportData('submitted');
      submitReportMutation.mutate({ report, isUpdate: !!existingDraftId });
    }
  };

  const canSaveDraft = selectedProject && selectedLead;
  const canSubmit = selectedProject && selectedLead && healthStatus && progress && nextWeek;

  const filteredLeadsForSearch = projectLeads
    .filter(lead => lead.name.toLowerCase().includes(statusLeadSearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

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

      <Card id="report-status-section" className="glass-card border-white/10">
        <CardHeader className="border-b border-white/5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="section-label">Weekly Submission</p>
              <CardTitle className="text-2xl">Submit Weekly Report</CardTitle>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {leadProjects.map((project) => {
                        const reportStatus = getProjectReportStatus(project.id);
                        const submittedByName = reportStatus === 'submitted' ? getSubmittedByName(project.id) : null;
                        const isCoLead = hasCoLeads(project);
                        return (
                          <div
                            key={project.id}
                            className="flex items-center justify-between bg-muted/30 border border-white/10 rounded-lg p-4 transition-all hover:bg-muted/50 cursor-pointer hover:border-primary/30"
                            data-testid={`status-${project.id}`}
                            onClick={() => handleProjectTileClick(project)}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{project.name}</p>
                                {isCoLead && (
                                  <Badge variant="outline" className="text-xs">Co-Lead</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{project.customer}</p>
                              {isCoLead && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Leads: {getProjectLeadNames(project)}
                                </p>
                              )}
                            </div>
                            {reportStatus === 'submitted' ? (
                              <div className="flex flex-col items-end gap-1">
                                <div className="flex items-center gap-2 text-success">
                                  <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
                                    <Check className="h-4 w-4" />
                                  </div>
                                  <span className="text-sm font-medium">Submitted</span>
                                </div>
                                {isCoLead && submittedByName && (
                                  <span className="text-xs text-muted-foreground">by {submittedByName}</span>
                                )}
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

      {/* Report Submission Modal - Opens when clicking on a project tile */}
      <Dialog open={showReportModal} onOpenChange={(open) => !open && closeReportModal()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {modalProject && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {getProjectReportStatus(modalProject.id) === 'submitted' ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      Report Already Submitted
                    </>
                  ) : getProjectReportStatus(modalProject.id) === 'drafted' ? (
                    <>
                      <PenLine className="h-5 w-5 text-primary" />
                      Continue Draft Report
                    </>
                  ) : (
                    <>
                      <FileText className="h-5 w-5 text-primary" />
                      Submit Weekly Report
                    </>
                  )}
                </DialogTitle>
                <DialogDescription>
                  <span className="font-medium">{modalProject.name}</span> - {modalProject.customer}
                  {hasCoLeads(modalProject) && (
                    <>
                      <br />
                      <span className="text-xs text-muted-foreground">Co-Leads: {getProjectLeadNames(modalProject)}</span>
                    </>
                  )}
                  <br />
                  <span className="text-xs">Week starting: {currentWeek}</span>
                </DialogDescription>
              </DialogHeader>

              {/* Warning banner when someone else is editing */}
              {projectLockInfo?.isLocked && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-warning/10 border border-warning/30" data-testid="lock-warning-banner">
                  <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-warning">Someone else is editing this report</p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">{projectLockInfo.lockedBy}</span> is currently editing this report. 
                      If you both submit changes, one may overwrite the other.
                    </p>
                  </div>
                </div>
              )}

              {getProjectReportStatus(modalProject.id) === 'submitted' ? (
                <div className="py-8 text-center space-y-4">
                  <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-8 w-8 text-success" />
                  </div>
                  <div>
                    <p className="text-lg font-medium">This report has already been submitted</p>
                    {hasCoLeads(modalProject) && getSubmittedByName(modalProject.id) && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Submitted by {getSubmittedByName(modalProject.id)}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground mt-2">
                      You can view this report under the <span className="font-medium text-primary">"View Current Report"</span> tab.
                    </p>
                  </div>
                  <Button variant="outline" onClick={closeReportModal} className="mt-4" data-testid="button-close-submitted-modal">
                    <Eye className="h-4 w-4 mr-2" />
                    Close
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleModalSubmit} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="modal-health-status">Project Health Status <span className="text-red-500">*</span></Label>
                    <Select value={modalHealthStatus} onValueChange={setModalHealthStatus}>
                      <SelectTrigger id="modal-health-status" data-testid="modal-select-health-status">
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
                    <Label htmlFor="modal-progress">Progress This Week <span className="text-red-500">*</span></Label>
                    <Textarea
                      id="modal-progress"
                      data-testid="modal-textarea-progress"
                      value={modalProgress}
                      onChange={(e) => setModalProgress(e.target.value)}
                      placeholder="Describe what was accomplished this week..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="modal-challenges">Challenges & Blockers</Label>
                    <Textarea
                      id="modal-challenges"
                      data-testid="modal-textarea-challenges"
                      value={modalChallenges}
                      onChange={(e) => setModalChallenges(e.target.value)}
                      placeholder="Describe any challenges or blockers..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="modal-next-week">Plans for Next Week <span className="text-red-500">*</span></Label>
                    <Textarea
                      id="modal-next-week"
                      data-testid="modal-textarea-next-week"
                      value={modalNextWeek}
                      onChange={(e) => setModalNextWeek(e.target.value)}
                      placeholder="Outline plans for the upcoming week..."
                      rows={3}
                    />
                  </div>

                  {getProjectTeamMembers(modalProject).length > 0 && (
                    <div className="space-y-3">
                      <Label>Team Member Feedback (Optional)</Label>
                      <div className="space-y-3 border rounded-md p-3">
                        {getProjectTeamMembers(modalProject).map((member) => (
                          <div key={member.id} className="space-y-1">
                            <Label htmlFor={`modal-feedback-${member.id}`} className="text-sm font-medium">
                              {member.name}
                            </Label>
                            <Textarea
                              id={`modal-feedback-${member.id}`}
                              data-testid={`modal-textarea-feedback-${member.id}`}
                              value={modalMemberFeedback[member.id] || ''}
                              onChange={(e) =>
                                setModalMemberFeedback({ ...modalMemberFeedback, [member.id]: e.target.value })
                              }
                              placeholder={`Feedback for ${member.name}...`}
                              rows={2}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <Button 
                      data-testid="modal-button-cancel"
                      type="button"
                      variant="outline"
                      onClick={closeReportModal}
                    >
                      Cancel
                    </Button>
                    {canModalSubmit ? (
                      <Button 
                        data-testid="modal-button-submit-report" 
                        type="submit" 
                        className="flex-1"
                        disabled={modalSubmitReportMutation.isPending}
                      >
                        {modalSubmitReportMutation.isPending ? 'Submitting...' : 'Submit Report'}
                      </Button>
                    ) : (
                      <Button 
                        data-testid="modal-button-save-draft" 
                        type="button"
                        className="flex-1"
                        disabled={!canModalSaveDraft || modalSaveDraftMutation.isPending}
                        onClick={handleModalSaveDraft}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {modalSaveDraftMutation.isPending ? 'Saving...' : modalExistingDraftId ? 'Update Draft' : 'Save as Draft'}
                      </Button>
                    )}
                  </div>
                </form>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
