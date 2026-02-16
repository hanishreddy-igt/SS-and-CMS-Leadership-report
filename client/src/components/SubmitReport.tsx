import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
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
import { AlertCircle, AlertTriangle, CheckCircle2, Check, Clock, FileText, ClipboardList, Filter, X, Save, PenLine, Eye, Info, Users, Sparkles, ArrowLeft } from 'lucide-react';
import type { Project, ProjectLead, WeeklyReport, TeamMember, TeamMemberFeedback, InsertWeeklyReport, TeamMemberAssignment } from '@shared/schema';

const healthStatusOptions = [
  { value: 'on-track', label: 'On Track', icon: CheckCircle2, color: 'text-success' },
  { value: 'at-risk', label: 'Needs Attention', icon: AlertTriangle, color: 'text-warning' },
  { value: 'critical', label: 'Critical', icon: AlertCircle, color: 'text-destructive' },
];

function getCurrentWeekStart(): string {
  const now = new Date();
  // Get UTC date components
  const utcYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth();
  const utcDate = now.getUTCDate();
  const utcDayOfWeek = now.getUTCDay();
  
  // Calculate days to go back to reach Monday
  const daysToMonday = (utcDayOfWeek + 6) % 7;
  
  // Create pure UTC date for Monday midnight
  const mondayUTC = new Date(Date.UTC(utcYear, utcMonth, utcDate - daysToMonday, 0, 0, 0, 0));
  
  const year = mondayUTC.getUTCFullYear();
  const month = String(mondayUTC.getUTCMonth() + 1).padStart(2, '0');
  const day = String(mondayUTC.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Calculate next Wednesday at 00:00 UTC (auto-archive day)
function getNextWednesdayUTC() {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const daysUntilWed = (3 - dayOfWeek + 7) % 7;
  const adjustedDays = daysUntilWed === 0 ? 7 : daysUntilWed;
  const nextWed = new Date(now);
  nextWed.setUTCDate(now.getUTCDate() + adjustedDays);
  nextWed.setUTCHours(0, 0, 0, 0);
  return nextWed;
}

// Type for reporting week API response
interface ReportingWeekResponse {
  weekStart: string;
  weekEnd: string;
  source: 'archive' | 'existing-reports' | 'calendar';
}

interface SubmitReportProps {
  initialLeadFilter?: string | null;
  onLeadFilterChange?: (leadName: string | null) => void;
}

export default function SubmitReport({ initialLeadFilter, onLeadFilterChange }: SubmitReportProps) {
  const { toast } = useToast();
  const permissions = usePermissions();
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ['/api/projects'] });
  const { data: projectLeads = [] } = useQuery<ProjectLead[]>({ queryKey: ['/api/project-leads'] });
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({ queryKey: ['/api/team-members'] });
  const { data: weeklyReports = [] } = useQuery<WeeklyReport[]>({ queryKey: ['/api/weekly-reports'] });
  
  // Get the active reporting week from the API (stays open until archive runs)
  const { data: reportingWeek } = useQuery<ReportingWeekResponse>({ 
    queryKey: ['/api/reporting-week'],
    staleTime: 30000, // Cache for 30 seconds
  });
  
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

  // Set initial lead filter from URL when projectLeads are loaded
  useEffect(() => {
    if (initialLeadFilter && projectLeads.length > 0) {
      // Support comma-separated first names for co-leads (e.g., "John,Jane")
      const filterNames = initialLeadFilter.split(',').map(n => n.trim().toLowerCase());
      const matchingLeadIds: string[] = [];
      
      for (const filterName of filterNames) {
        const matchingLead = projectLeads.find(lead => 
          lead.name.toLowerCase().startsWith(filterName)
        );
        if (matchingLead) {
          matchingLeadIds.push(matchingLead.id);
        }
      }
      
      if (matchingLeadIds.length > 0) {
        setStatusFilterLeads(new Set(matchingLeadIds));
      }
    }
  }, [initialLeadFilter, projectLeads]);

  // Use API-provided week or fall back to local calculation
  const currentWeek = reportingWeek?.weekStart || getCurrentWeekStart();
  
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

  const getProjectAiDraftStatus = (projectId: string): string | null => {
    const report = currentWeekReports.find((r) => r.projectId === projectId);
    return report?.aiDraftStatus || null;
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

  // Close the inline detail view and reset state
  const closeReportModal = async () => {
    // Release the lock when closing
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

  // Check if we're filtering by a single lead (for split view of sole/co-lead projects)
  const isSingleLeadFilter = statusFilterLeads.size === 1;
  const singleFilterLeadId = isSingleLeadFilter ? Array.from(statusFilterLeads)[0] : null;

  const filteredStatusProjects = projects.filter((project) => {
    // Exclude ended projects from the status list
    if (isProjectEndedCheck(project.endDate)) return false;
    
    const projectLeadIds = getProjectLeadIds(project);
    if (statusFilterLeads.size > 0) {
      if (isSingleLeadFilter) {
        // Single lead filter: include projects where lead is sole OR co-lead
        const hasThisLead = projectLeadIds.includes(singleFilterLeadId!);
        if (!hasThisLead) return false;
      } else {
        // Multiple leads filter: require EXACT match of lead combinations
        const projectLeadSet = new Set(projectLeadIds);
        const sameSize = projectLeadSet.size === statusFilterLeads.size;
        const allMatch = Array.from(statusFilterLeads).every(id => projectLeadSet.has(id));
        if (!sameSize || !allMatch) return false;
      }
    }
    
    const reportStatus = getProjectReportStatus(project.id);
    if (statusFilterStatus === 'submitted' && reportStatus !== 'submitted') return false;
    if (statusFilterStatus === 'drafted' && reportStatus !== 'drafted') return false;
    if (statusFilterStatus === 'pending' && reportStatus !== 'pending') return false;
    // 'awaiting' means pending OR drafted (not submitted yet)
    if (statusFilterStatus === 'awaiting' && reportStatus === 'submitted') return false;
    
    return true;
  });

  // When single lead filter, split into sole-lead and co-lead projects
  const soleLeadProjects = isSingleLeadFilter 
    ? filteredStatusProjects.filter(p => {
        const leadIds = getProjectLeadIds(p);
        return leadIds.length === 1 && leadIds[0] === singleFilterLeadId;
      })
    : [];
  
  const coLeadProjects = isSingleLeadFilter
    ? filteredStatusProjects.filter(p => {
        const leadIds = getProjectLeadIds(p);
        return leadIds.length > 1 && leadIds.includes(singleFilterLeadId!);
      })
    : [];

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

  // Group active projects by combined lead names for Weekly Progress
  const leadCategoryStats = activeProjects.reduce((acc, project) => {
    const combinedName = getProjectLeadNames(project);
    const leadIds = getProjectLeadIds(project);
    if (!acc[combinedName]) {
      acc[combinedName] = { 
        name: combinedName, 
        leadIds, 
        total: 0, 
        submitted: 0 
      };
    }
    acc[combinedName].total++;
    if (hasSubmittedForProject(project.id)) {
      acc[combinedName].submitted++;
    }
    return acc;
  }, {} as Record<string, { name: string; leadIds: string[]; total: number; submitted: number }>);

  // Get all lead categories sorted by name
  const leadCategoriesWithActiveProjects = Object.values(leadCategoryStats)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Get the name of who submitted a report
  const getSubmittedByName = (projectId: string): string | null => {
    const report = currentWeekReports.find((r) => r.projectId === projectId && r.status === 'submitted');
    if (report && report.submittedByLeadId) {
      return getLeadName(report.submittedByLeadId);
    }
    return null;
  };

  // Group projects by combined lead names - co-lead projects show as "Primary & Co-Lead"
  const groupedByLead = filteredStatusProjects.reduce((acc, project) => {
    const combinedLeadName = getProjectLeadNames(project);
    if (!acc[combinedLeadName]) {
      acc[combinedLeadName] = [];
    }
    // Avoid duplicates
    if (!acc[combinedLeadName].some(p => p.id === project.id)) {
      acc[combinedLeadName].push(project);
    }
    return acc;
  }, {} as Record<string, Project[]>);

  const activeFilterCount = (statusFilterLeads.size > 0 ? 1 : 0) + (statusFilterStatus !== 'all' ? 1 : 0);

  const clearAllFilters = () => {
    setStatusFilterLeads(new Set());
    setStatusFilterStatus('all');
    setStatusLeadSearch('');
    onLeadFilterChange?.(null);
  };

  const toggleLeadFilter = (leadId: string) => {
    const newSet = new Set(statusFilterLeads);
    if (newSet.has(leadId)) {
      newSet.delete(leadId);
    } else {
      newSet.add(leadId);
    }
    setStatusFilterLeads(newSet);
    
    // Update URL with first names of selected leads
    if (onLeadFilterChange) {
      if (newSet.size === 0) {
        onLeadFilterChange(null);
      } else {
        const selectedLeadNames = Array.from(newSet)
          .map(id => projectLeads.find(l => l.id === id)?.name.split(' ')[0])
          .filter(Boolean)
          .join(',');
        onLeadFilterChange(selectedLeadNames);
      }
    }
  };

  const generateAiDraftsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/scheduler/generate-report-drafts');
    },
    onSuccess: async (response: any) => {
      const data = await response.json();
      queryClient.invalidateQueries({ queryKey: ['/api/weekly-reports'] });
      const drafted = data.draftsGenerated || 0;
      const autoCreated = data.autoCreated || 0;
      const skippedAlready = (data.results || []).filter((r: any) => r.status === 'skipped_already_drafted').length;
      const skippedNoActivity = (data.results || []).filter((r: any) => r.status === 'skipped_no_activity').length;
      
      let description = `${drafted} report${drafted !== 1 ? 's' : ''} drafted with AI`;
      if (autoCreated > 0) description += ` (${autoCreated} auto-created)`;
      if (skippedAlready > 0) description += `, ${skippedAlready} already drafted`;
      if (skippedNoActivity > 0) description += `, ${skippedNoActivity} had no task activity`;
      
      toast({
        title: drafted > 0 ? 'AI Drafts Generated' : 'No New Drafts',
        description,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate AI drafts',
        variant: 'destructive'
      });
    }
  });

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
      const isConnectionError = error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('Failed to fetch');
      toast({ 
        title: isConnectionError ? 'Connection Lost' : 'Error', 
        description: isConnectionError 
          ? 'Unable to save. Please refresh the page and try again.' 
          : (error.message || 'Failed to save draft'),
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
      const isConnectionError = error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('Failed to fetch');
      toast({ 
        title: isConnectionError ? 'Connection Lost' : 'Error', 
        description: isConnectionError 
          ? 'Unable to submit. Please refresh the page and try again.' 
          : (error.message || 'Failed to submit report'),
        variant: 'destructive'
      });
    }
  });

  const buildReportData = (status: 'draft' | 'submitted'): InsertWeeklyReport => {
    const memberFeedbackList: TeamMemberFeedback[] = Object.entries(memberFeedback)
      .filter(([_, feedback]) => feedback.trim())
      .map(([memberId, feedback]) => ({ memberId, feedback }));

    const existingReport = currentWeekReports.find(r => r.projectId === selectedProject);
    const currentAiDraftStatus = existingReport?.aiDraftStatus;

    return {
      projectId: selectedProject,
      leadId: selectedLead,
      weekStart: currentWeek,
      healthStatus: healthStatus || null,
      progress: progress || null,
      challenges: challenges || null,
      nextWeek: nextWeek || null,
      teamMemberFeedback: memberFeedbackList.length > 0 ? memberFeedbackList : null,
      status,
      aiDraftStatus: currentAiDraftStatus === 'generated' ? 'edited' : currentAiDraftStatus || null,
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
      const isConnectionError = error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('Failed to fetch');
      toast({ 
        title: isConnectionError ? 'Connection Lost' : 'Error', 
        description: isConnectionError 
          ? 'Unable to save. Please refresh the page and try again.' 
          : (error.message || 'Failed to save draft'),
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
      const isConnectionError = error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('Failed to fetch');
      toast({ 
        title: isConnectionError ? 'Connection Lost' : 'Error', 
        description: isConnectionError 
          ? 'Unable to submit. Please refresh the page and try again.' 
          : (error.message || 'Failed to submit report'),
        variant: 'destructive'
      });
    }
  });

  // Build report data for modal
  const buildModalReportData = (status: 'draft' | 'submitted'): InsertWeeklyReport | null => {
    if (!modalProject) return null;
    
    const memberFeedbackList: TeamMemberFeedback[] = Object.entries(modalMemberFeedback)
      .filter(([_, feedback]) => feedback.trim())
      .map(([memberId, feedback]) => ({ memberId, feedback }));

    // Get the primary lead ID from co-leads array or fallback to legacy leadId
    const projectLeadIds = getProjectLeadIds(modalProject);
    const primaryLeadId = projectLeadIds[0] || modalProject.leadId;

    const existingReport = currentWeekReports.find(r => r.projectId === modalProject.id);
    const currentAiDraftStatus = existingReport?.aiDraftStatus;

    return {
      projectId: modalProject.id,
      leadId: primaryLeadId,
      weekStart: currentWeek,
      healthStatus: modalHealthStatus || null,
      progress: modalProgress || null,
      challenges: modalChallenges || null,
      nextWeek: modalNextWeek || null,
      teamMemberFeedback: memberFeedbackList.length > 0 ? memberFeedbackList : null,
      status,
      aiDraftStatus: currentAiDraftStatus === 'generated' ? 'edited' : currentAiDraftStatus || null,
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
    onLeadFilterChange?.(null);
    
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
    onLeadFilterChange?.(null);
    
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

  // Handle clicking on a lead category in the Weekly Progress section
  const handleLeadProgressClick = (leadIds: string[]) => {
    // Toggle: if already filtered to these exact leads, clear the filter
    const leadIdSet = new Set(leadIds);
    const isAlreadySelected = leadIds.length === statusFilterLeads.size && 
      leadIds.every(id => statusFilterLeads.has(id));
    
    if (isAlreadySelected) {
      setStatusFilterLeads(new Set());
      // Notify parent to clear URL param
      onLeadFilterChange?.(null);
    } else {
      setStatusFilterLeads(leadIdSet);
      // Notify parent to update URL with all leads' first names (comma-separated for co-leads)
      const firstNames = leadIds
        .map(id => projectLeads.find(l => l.id === id)?.name.split(' ')[0])
        .filter(Boolean)
        .join(',');
      if (firstNames) {
        onLeadFilterChange?.(firstNames);
      }
    }
    setStatusLeadSearch('');
    setStatusFilterStatus('all');
    
    // Scroll to the report status section
    setTimeout(() => {
      const statusSection = document.getElementById('report-status-section');
      if (statusSection) {
        statusSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  return (
    <div className="space-y-8">
      {/* Weekly Progress - Lead Category Status Grid */}
      {leadCategoriesWithActiveProjects.length > 0 && (
        <div className="glass-card rounded-xl p-6" data-testid="progress-submitted">
          <p className="section-label mb-4">Weekly Progress</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {leadCategoriesWithActiveProjects.map((category) => {
              const allSubmitted = category.total > 0 && category.submitted === category.total;
              const isSelected = category.leadIds.length === statusFilterLeads.size && 
                category.leadIds.every(id => statusFilterLeads.has(id));
              return (
                <div
                  key={category.name}
                  onClick={() => handleLeadProgressClick(category.leadIds)}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all hover-elevate ${isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-muted/20'}`}
                  data-testid={`lead-progress-${category.leadIds.join('-')}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {allSubmitted ? (
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                    )}
                    <span className="text-sm truncate">{category.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{category.submitted}/{category.total}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Card id="report-status-section" data-testid="card-submit-report" className="glass-card border-white/10">
        <CardHeader className="border-b border-white/5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="section-label">Weekly Submission</p>
              <CardTitle className="text-2xl">Submit Weekly Report</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Week starting: <span className="text-primary font-medium">{currentWeek}</span></p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {permissions.isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  data-testid="button-generate-ai-drafts"
                  disabled={generateAiDraftsMutation.isPending}
                  onClick={() => generateAiDraftsMutation.mutate()}
                >
                  <Sparkles className="h-4 w-4" />
                  {generateAiDraftsMutation.isPending ? 'Generating...' : 'Generate AI Drafts'}
                </Button>
              )}
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
          </div>
        </CardHeader>
        <CardContent>
          {showReportModal && modalProject ? (
            /* Inline Report Detail View */
            <div className="space-y-6" data-testid="section-report-detail">
              {/* Back button and header */}
              <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={closeReportModal}
                  data-testid="button-back-to-reports"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {getProjectReportStatus(modalProject.id) === 'submitted' ? (
                      <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                    ) : getProjectReportStatus(modalProject.id) === 'drafted' ? (
                      <PenLine className="h-5 w-5 text-primary shrink-0" />
                    ) : (
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                    )}
                    <h2 className="text-xl font-semibold truncate" data-testid="text-report-project-name">{modalProject.name}</h2>
                    {getProjectReportStatus(modalProject.id) === 'submitted' && (
                      <Badge variant="outline" className="text-success border-success/30 shrink-0">Submitted</Badge>
                    )}
                    {getProjectReportStatus(modalProject.id) === 'drafted' && (
                      <Badge variant="outline" className="text-primary border-primary/30 shrink-0">Draft</Badge>
                    )}
                    {getProjectReportStatus(modalProject.id) === 'pending' && (
                      <Badge variant="outline" className="text-warning border-warning/30 shrink-0">Pending</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    {modalProject.customer && <span>{modalProject.customer}</span>}
                    {hasCoLeads(modalProject) && (
                      <span className="text-xs">Co-Leads: {getProjectLeadNames(modalProject)}</span>
                    )}
                    <span className="text-xs">Week: {currentWeek}</span>
                  </div>
                </div>
              </div>

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
                <div className="py-12 text-center space-y-4">
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
                  <Button variant="outline" onClick={closeReportModal} className="mt-4" data-testid="button-back-submitted">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to All Reports
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleModalSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="modal-health-status">Contract Health Status <span className="text-red-500">*</span></Label>
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
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="modal-progress">Progress in Previous Week <span className="text-red-500">*</span></Label>
                    <Textarea
                      id="modal-progress"
                      data-testid="modal-textarea-progress"
                      value={modalProgress}
                      onChange={(e) => setModalProgress(e.target.value)}
                      placeholder="Describe what was accomplished this week..."
                      rows={8}
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
                      rows={8}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="modal-next-week">Plans for Current Week <span className="text-red-500">*</span></Label>
                    <Textarea
                      id="modal-next-week"
                      data-testid="modal-textarea-next-week"
                      value={modalNextWeek}
                      onChange={(e) => setModalNextWeek(e.target.value)}
                      placeholder="Outline plans for the upcoming week..."
                      rows={8}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-white/10">
                    <Button 
                      data-testid="modal-button-cancel"
                      type="button"
                      variant="outline"
                      onClick={closeReportModal}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                    <Button 
                      data-testid="modal-button-save-draft" 
                      type="button"
                      variant="outline"
                      disabled={!canModalSaveDraft || modalSaveDraftMutation.isPending}
                      onClick={handleModalSaveDraft}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {modalSaveDraftMutation.isPending ? 'Saving...' : modalExistingDraftId ? 'Update Draft' : 'Save as Draft'}
                    </Button>
                    {permissions.canSubmitReports && (
                      <Button 
                        data-testid="modal-button-submit-report" 
                        type="submit" 
                        className="flex-1"
                        disabled={!canModalSubmit || modalSubmitReportMutation.isPending}
                      >
                        {modalSubmitReportMutation.isPending ? 'Submitting...' : 'Submit Report'}
                      </Button>
                    )}
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* Report List View */
            <>
          {/* Auto-archive schedule banner */}
          <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-start gap-3">
            <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-primary mb-1">Automatic Archive Schedule</p>
              <p className="text-muted-foreground">
                Reports are automatically archived and reset every <span className="text-primary font-medium">Wednesday at 00:00 UTC</span>.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Next auto-archive: <span className="text-foreground">{getNextWednesdayUTC().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} 00:00 UTC</span>
              </p>
            </div>
          </div>

          <div className="space-y-6" data-testid="section-report-status">
            {Object.keys(groupedByLead).length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No projects found matching the filters.</p>
            ) : isSingleLeadFilter ? (
              // Single lead filter - show split sections for As Lead and As Co-Lead
              (() => {
                const filterLeadName = singleFilterLeadId ? getLeadName(singleFilterLeadId) : '';
                
                // Sort function for projects: drafted first, then pending, then submitted
                const sortProjects = (projects: Project[]) => [...projects].sort((a, b) => {
                  const statusOrder = { 'drafted': 0, 'pending': 1, 'submitted': 2 };
                  const statusA = getProjectReportStatus(a.id) as keyof typeof statusOrder;
                  const statusB = getProjectReportStatus(b.id) as keyof typeof statusOrder;
                  return (statusOrder[statusA] ?? 1) - (statusOrder[statusB] ?? 1);
                });

                const renderProjectGrid = (projects: Project[], showCoLeadPartner: boolean = false) => (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {projects.map((project) => {
                      const reportStatus = getProjectReportStatus(project.id);
                      const coLeadNames = showCoLeadPartner 
                        ? getProjectLeadIds(project)
                            .filter(id => id !== singleFilterLeadId)
                            .map(id => getLeadName(id))
                            .join(' & ')
                        : null;
                      const aiDraftStatus = getProjectAiDraftStatus(project.id);
                      return (
                        <div
                          key={project.id}
                          className="flex items-center justify-between bg-muted/30 border border-white/10 rounded-lg p-4 transition-all hover:bg-muted/50 cursor-pointer hover:border-primary/30"
                          data-testid={`status-${project.id}`}
                          onClick={() => handleProjectTileClick(project)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium truncate">{project.name}</p>
                              {aiDraftStatus === 'generated' && (
                                <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" data-testid={`ai-draft-indicator-${project.id}`} />
                              )}
                            </div>
                            {coLeadNames && (
                              <p className="text-xs text-muted-foreground mt-1">with {coLeadNames}</p>
                            )}
                          </div>
                          {reportStatus === 'submitted' ? (
                            <div className="flex items-center gap-2 text-success shrink-0">
                              <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
                                <Check className="h-4 w-4" />
                              </div>
                              <span className="text-sm font-medium">Submitted</span>
                            </div>
                          ) : reportStatus === 'drafted' ? (
                            <div className="flex items-center gap-2 text-primary shrink-0">
                              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                {aiDraftStatus === 'generated' ? <Sparkles className="h-4 w-4" /> : <PenLine className="h-4 w-4" />}
                              </div>
                              <span className="text-sm font-medium">{aiDraftStatus === 'generated' ? 'AI Draft' : 'Drafted'}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-warning shrink-0">
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
                );

                const sortedSoleProjects = sortProjects(soleLeadProjects);
                const sortedCoProjects = sortProjects(coLeadProjects);
                const soleSubmitted = soleLeadProjects.filter(p => getProjectReportStatus(p.id) === 'submitted').length;
                const coSubmitted = coLeadProjects.filter(p => getProjectReportStatus(p.id) === 'submitted').length;

                return (
                  <div className="space-y-6">
                    {/* As Lead Section */}
                    {soleLeadProjects.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <h3 className="text-base font-bold uppercase tracking-wide text-muted-foreground">As Lead</h3>
                          <span className="text-sm text-muted-foreground">{soleSubmitted}/{soleLeadProjects.length} submitted</span>
                        </div>
                        {renderProjectGrid(sortedSoleProjects, false)}
                      </div>
                    )}

                    {/* As Co-Lead Section */}
                    {coLeadProjects.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <h3 className="text-base font-bold uppercase tracking-wide text-muted-foreground">As Co-Lead</h3>
                          <span className="text-sm text-muted-foreground">{coSubmitted}/{coLeadProjects.length} submitted</span>
                        </div>
                        {renderProjectGrid(sortedCoProjects, true)}
                      </div>
                    )}

                    {soleLeadProjects.length === 0 && coLeadProjects.length === 0 && (
                      <p className="text-muted-foreground text-center py-4">No projects found for {filterLeadName}.</p>
                    )}
                  </div>
                );
              })()
            ) : (
              // Multiple leads or no filter - show grouped by lead
              Object.entries(groupedByLead).map(([leadName, leadProjects]) => {
                const submitted = leadProjects.filter((p) => getProjectReportStatus(p.id) === 'submitted').length;
                const total = leadProjects.length;
                const isComplete = submitted === total;

                // Sort projects: drafted first, then pending, then submitted
                const sortedLeadProjects = [...leadProjects].sort((a, b) => {
                  const statusOrder = { 'drafted': 0, 'pending': 1, 'submitted': 2 };
                  const statusA = getProjectReportStatus(a.id) as keyof typeof statusOrder;
                  const statusB = getProjectReportStatus(b.id) as keyof typeof statusOrder;
                  return (statusOrder[statusA] ?? 1) - (statusOrder[statusB] ?? 1);
                });

                return (
                  <div key={leadName} className="space-y-3">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <h3 className="text-base font-bold uppercase tracking-wide text-muted-foreground">{leadName}</h3>
                      <span className="text-sm text-muted-foreground">
                        {submitted}/{total} submitted
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {sortedLeadProjects.map((project) => {
                        const reportStatus = getProjectReportStatus(project.id);
                        const isCoLead = hasCoLeads(project);
                        return (
                          <div
                            key={project.id}
                            className="flex items-center justify-between bg-muted/30 border border-white/10 rounded-lg p-4 transition-all hover:bg-muted/50 cursor-pointer hover:border-primary/30"
                            data-testid={`status-${project.id}`}
                            onClick={() => handleProjectTileClick(project)}
                          >
                            <div className="flex-1">
                              <p className="font-medium">{project.name}</p>
                              {isCoLead && (
                                <Badge variant="outline" className="text-xs mt-1">Co-Lead</Badge>
                              )}
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
          </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
