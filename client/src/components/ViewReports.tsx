import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Edit2, X, CheckCircle2, AlertTriangle, AlertCircle, FileDown, FileText, Filter, ChevronDown, ChevronUp, Calendar, User, Users, Clock, Sparkles, TrendingUp, Target, Lightbulb, Loader2, Archive, Download, Save, Info, Trash2, MessageSquare, RefreshCw } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { WeeklyReport, ProjectLead, TeamMember, Project, TeamMemberFeedback, SavedReport, TeamMemberAssignment, Person, FeedbackEntry } from '@shared/schema';

const healthStatusConfig = {
  'on-track': { label: 'On Track', icon: CheckCircle2, color: 'text-success', bgColor: 'bg-success/10' },
  'at-risk': { label: 'Needs Attention', icon: AlertTriangle, color: 'text-warning', bgColor: 'bg-warning/10' },
  'critical': { label: 'Critical', icon: AlertCircle, color: 'text-destructive', bgColor: 'bg-destructive/10' },
};

interface ViewReportsProps {
  externalHealthFilter?: string;
  onClearExternalFilter?: () => void;
}

// Type for reporting week API response
interface ReportingWeekResponse {
  weekStart: string;
  weekEnd: string;
  source: 'archive' | 'existing-reports' | 'calendar';
}

export default function ViewReports({ externalHealthFilter, onClearExternalFilter }: ViewReportsProps) {
  const { toast } = useToast();
  const permissions = usePermissions();
  const { user } = useAuth();
  const { data: weeklyReports = [] } = useQuery<WeeklyReport[]>({ queryKey: ['/api/weekly-reports'] });
  const { data: projectLeads = [] } = useQuery<ProjectLead[]>({ queryKey: ['/api/project-leads'] });
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({ queryKey: ['/api/team-members'] });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ['/api/projects'] });
  const { data: peopleWithFeedback = [] } = useQuery<Person[]>({ queryKey: ['/api/people/feedback'] });
  // Feedback entries with submitter tracking - filtered by backend based on user role
  const { data: feedbackEntries = [] } = useQuery<FeedbackEntry[]>({ queryKey: ['/api/feedback-entries'] });
  const { data: allPeople = [] } = useQuery<Person[]>({ queryKey: ['/api/people'] });
  
  // Get the active reporting week from the API (stays open until archive runs)
  const { data: reportingWeek } = useQuery<ReportingWeekResponse>({ 
    queryKey: ['/api/reporting-week'],
    staleTime: 30000, // Cache for 30 seconds
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    progress: '',
    challenges: '',
    nextWeek: '',
    healthStatus: '',
    teamMemberFeedback: [] as TeamMemberFeedback[],
  });
  
  const [filterLeads, setFilterLeads] = useState<Set<string>>(new Set());
  const [filterMembers, setFilterMembers] = useState<Set<string>>(new Set());
  const [filterHealth, setFilterHealth] = useState<string>('all');
  const [filterProjectStatus, setFilterProjectStatus] = useState<string>('all');
  const [leadSearch, setLeadSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  
  // Report Detail Modal State
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null);
  const [showReportDetailModal, setShowReportDetailModal] = useState(false);

  // AI Summary State - Comprehensive Leadership Summary
  interface PortfolioHealthCategory {
    count: number;
    projects: string[];
  }
  
  interface PortfolioHealthBreakdown {
    onTrack: PortfolioHealthCategory;
    needsAttention: PortfolioHealthCategory;
    critical: PortfolioHealthCategory;
  }
  
  interface AttentionItem {
    project: string;
    customer: string;
    lead: string;
    issue: string;
    recommendedAction: string;
  }
  
  interface AchievementItem {
    project: string;
    achievement: string;
    impact: string;
  }
  
  interface CrossProjectPatterns {
    commonChallenges: string[];
    resourceConstraints: string[];
    processIssues: string[];
    emergingRisks?: string[];
    positiveIndicators?: string[];
  }
  
  interface UpcomingFocusItem {
    project: string;
    focus: string;
    priority: 'high' | 'medium' | 'low';
  }
  
  interface LeadershipAction {
    action: string;
    priority: 'high' | 'medium';
    rationale: string;
  }
  
  interface WeekOverWeekChanges {
    improved: string[];
    worsened: string[];
    newRisks: string[];
    resolved: string[];
  }

  interface DependencyItem {
    project: string;
    dependency: string;
    impact: string;
    requiredSupport: string;
  }

  interface AISummary {
    overallHealth: 'on-track' | 'needs-attention' | 'critical';
    executiveSummary: string;
    weekOverWeekChanges?: WeekOverWeekChanges;
    portfolioHealthBreakdown?: PortfolioHealthBreakdown;
    immediateAttentionRequired?: AttentionItem[];
    keyAchievements?: AchievementItem[] | string[];
    crossProjectPatterns?: CrossProjectPatterns;
    dependenciesAndCrossTeamNeeds?: DependencyItem[];
    upcomingFocus?: UpcomingFocusItem[] | string[];
    recommendedLeadershipActions?: LeadershipAction[];
    weekHighlights?: string[];
    // Legacy fields for backward compatibility
    criticalIssues?: string[];
    attentionNeeded?: string[];
  }
  
  // Comprehensive SS/CMS Team Feedback Summary
  interface TeamHighlightItem {
    memberName: string;
    project: string;
    highlight: string;
  }
  
  interface RecognitionItem {
    memberName: string;
    project: string;
    achievement: string;
    suggestedRecognition: string;
  }
  
  interface TeamConcernItem {
    concern: string;
    affectedMembers: string[] | string;
    project: string;
    severity: 'high' | 'medium' | 'low';
  }
  
  interface WorkloadObservation {
    observation: string;
    affectedMembers: string[];
    recommendation: string;
  }
  
  interface SupportNeededItem {
    area: string;
    members: string[];
    suggestedSupport: string;
  }
  
  interface DevelopmentOpportunity {
    memberName: string;
    opportunity: string;
    rationale: string;
  }
  
  interface RetentionRisk {
    indicator: string;
    members: string[];
    recommendedAction: string;
  }
  
  interface HRAction {
    action: string;
    priority: 'high' | 'medium';
    rationale: string;
  }
  
  interface TeamSummary {
    overallTeamMorale: 'positive' | 'mixed' | 'concerning';
    teamSummary: string;
    teamHighlights?: TeamHighlightItem[] | string[];
    recognitionOpportunities?: RecognitionItem[] | string[];
    teamConcerns?: TeamConcernItem[] | string[];
    workloadObservations?: WorkloadObservation[];
    supportNeeded?: SupportNeededItem[] | string[];
    developmentOpportunities?: DevelopmentOpportunity[];
    retentionRisks?: RetentionRisk[];
    recommendedHRActions?: HRAction[];
  }
  
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [teamSummary, setTeamSummary] = useState<TeamSummary | null>(null);
  const [summaryGeneratedAt, setSummaryGeneratedAt] = useState<string | null>(null);
  const [reportsAnalyzed, setReportsAnalyzed] = useState<number>(0);
  const [showLeadershipModal, setShowLeadershipModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  
  // Auto-archive tracking
  const autoArchiveTriggered = useRef(false);
  const [isAutoArchiving, setIsAutoArchiving] = useState(false);

  // Get current week start from API (primary) or reports (fallback)
  // The API ensures the week stays open until archive runs
  const currentWeekStart = reportingWeek?.weekStart || (weeklyReports.length > 0 ? weeklyReports[0].weekStart : null);

  // Check if reports were modified after AI summary was generated
  const reportsModifiedAfterSummary = (() => {
    if (!summaryGeneratedAt || weeklyReports.length === 0) return false;
    const summaryTime = new Date(summaryGeneratedAt).getTime();
    const latestReportTime = Math.max(
      ...weeklyReports.map(r => new Date(r.submittedAt).getTime())
    );
    return latestReportTime > summaryTime;
  })();

  // Load AI summary from database on mount
  // Combined summary structure: { leadership: AISummary, team: TeamSummary | null }
  interface CombinedSummary {
    leadership: AISummary;
    team: TeamSummary | null;
  }
  
  interface SavedAiSummaryResponse {
    summary: AISummary | CombinedSummary | null;
    reportsAnalyzed?: number;
    generatedAt?: string;
  }
  const { data: savedAiSummary } = useQuery<SavedAiSummaryResponse>({
    queryKey: ['/api/current-ai-summary', currentWeekStart],
    enabled: !!currentWeekStart,
  });

  // Update local state when saved AI summary is loaded from database
  useEffect(() => {
    if (savedAiSummary && savedAiSummary.summary) {
      // Check if it's the new combined format or old format
      const summary = savedAiSummary.summary as any;
      if (summary.leadership) {
        // New combined format
        setAiSummary(summary.leadership);
        setTeamSummary(summary.team || null);
      } else if (summary.overallHealth) {
        // Old format - just leadership summary
        setAiSummary(summary as AISummary);
        setTeamSummary(null);
      }
      setSummaryGeneratedAt(savedAiSummary.generatedAt || null);
      setReportsAnalyzed(savedAiSummary.reportsAnalyzed || 0);
    }
  }, [savedAiSummary]);

  // Auto-archive on Wednesday 00:00 UTC
  useEffect(() => {
    const checkAndAutoArchive = async () => {
      // Don't run if already triggered or no reports
      if (autoArchiveTriggered.current || weeklyReports.length === 0) return;
      
      const now = new Date();
      const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 3 = Wednesday
      
      // Check if it's Wednesday or later in the week (Wed, Thu, Fri, Sat)
      const isWednesdayOrLater = dayOfWeek >= 3 || dayOfWeek === 0; // Wed(3), Thu(4), Fri(5), Sat(6), Sun(0)
      
      if (!isWednesdayOrLater) return;
      
      // Get the week start of the reports
      const reportWeekStart = weeklyReports[0].weekStart;
      
      // Calculate the Monday of the current week using pure UTC
      const utcYear = now.getUTCFullYear();
      const utcMonth = now.getUTCMonth();
      const utcDate = now.getUTCDate();
      const daysToMonday = (dayOfWeek + 6) % 7;
      const currentMondayUTC = new Date(Date.UTC(utcYear, utcMonth, utcDate - daysToMonday, 0, 0, 0, 0));
      const currentWeekMonday = `${currentMondayUTC.getUTCFullYear()}-${String(currentMondayUTC.getUTCMonth() + 1).padStart(2, '0')}-${String(currentMondayUTC.getUTCDate()).padStart(2, '0')}`;
      
      // If reports are from a previous week (not current week), auto-archive
      if (reportWeekStart < currentWeekMonday) {
        console.log('Auto-archive triggered: Reports from previous week detected on/after Wednesday');
        autoArchiveTriggered.current = true;
        setIsAutoArchiving(true);
        
        try {
          // Calculate week end (Sunday) from week start
          const weekStartDate = new Date(reportWeekStart + 'T00:00:00Z');
          const weekEndDate = new Date(weekStartDate);
          weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6);
          const weekEnd = weekEndDate.toISOString().split('T')[0];
          
          // ALWAYS generate AI summaries (leadership + team) before archiving if they don't exist
          let leadershipSummaryToArchive = aiSummary;
          let teamSummaryToArchive = teamSummary;
          if (!leadershipSummaryToArchive) {
            console.log('Auto-archive: Generating AI summaries before archiving...');
            try {
              const summaryResponse = await apiRequest('POST', '/api/weekly-reports/ai-summary');
              const summaryData = await summaryResponse.json();
              if (summaryData.summary) {
                leadershipSummaryToArchive = summaryData.summary;
                teamSummaryToArchive = summaryData.teamSummary || null;
                // Update local state with the generated summaries
                setAiSummary(summaryData.summary);
                setTeamSummary(summaryData.teamSummary || null);
                setSummaryGeneratedAt(summaryData.generatedAt);
                setReportsAnalyzed(summaryData.reportsAnalyzed || 0);
              }
            } catch (summaryError) {
              console.error('Failed to generate AI summaries for auto-archive:', summaryError);
              // Continue with archiving even if summary generation fails
            }
          }
          
          // Generate separate data for Account Reports and Team Reports
          console.log('Auto-archive: Generating separate PDFs and CSVs...');
          const submittedReports = weeklyReports.filter(r => r.status === 'submitted');
          
          // Calculate health counts from submitted reports only
          const healthCounts = {
            onTrack: submittedReports.filter(r => r.healthStatus === 'on-track').length,
            needsAttention: submittedReports.filter(r => r.healthStatus === 'at-risk').length,
            critical: submittedReports.filter(r => r.healthStatus === 'critical').length,
          };
          
          // Account Report: Leadership summary PDF + Account reports CSV
          const accountPdfBase64 = leadershipSummaryToArchive 
            ? generateAISummaryPDFBase64(weekEnd, leadershipSummaryToArchive, null)
            : '';
          const accountCsvContent = generateAccountReportsCSV();
          
          // Team Report: Team feedback summary PDF + Team feedback CSV
          const teamPdfBase64 = teamSummaryToArchive 
            ? generateAISummaryPDFBase64(weekEnd, null, teamSummaryToArchive)
            : '';
          const teamCsvContent = generateTeamFeedbackCSV();
          
          console.log(`[Auto-Archive] Account PDF size: ${(accountPdfBase64.length / 1024 / 1024).toFixed(2)} MB`);
          console.log(`[Auto-Archive] Account CSV size: ${(accountCsvContent.length / 1024).toFixed(2)} KB`);
          console.log(`[Auto-Archive] Team PDF size: ${(teamPdfBase64.length / 1024 / 1024).toFixed(2)} MB`);
          console.log(`[Auto-Archive] Team CSV size: ${(teamCsvContent.length / 1024).toFixed(2)} KB`);
          
          // Archive via API - Save 2 separate reports (Account + Team)
          // Save Account Report (type: 'account')
          const accountArchiveResponse = await apiRequest('POST', '/api/saved-reports', {
            weekStart: reportWeekStart,
            weekEnd: weekEnd,
            reportType: 'account',
            reportCount: String(submittedReports.length),
            healthCounts,
            aiSummary: leadershipSummaryToArchive,
            pdfData: accountPdfBase64,
            csvData: accountCsvContent,
          });
          
          if (!accountArchiveResponse.ok) {
            const errorData = await accountArchiveResponse.json().catch(() => ({}));
            throw new Error(errorData.error || `Account archive save failed with status ${accountArchiveResponse.status}`);
          }
          
          // Save Team Report (type: 'team')
          const teamArchiveResponse = await apiRequest('POST', '/api/saved-reports', {
            weekStart: reportWeekStart,
            weekEnd: weekEnd,
            reportType: 'team',
            reportCount: String(peopleWithFeedback.length),
            healthCounts: null,
            aiSummary: teamSummaryToArchive,
            pdfData: teamPdfBase64,
            csvData: teamCsvContent,
          });
          
          if (!teamArchiveResponse.ok) {
            const errorData = await teamArchiveResponse.json().catch(() => ({}));
            throw new Error(errorData.error || `Team archive save failed with status ${teamArchiveResponse.status}`);
          }
          
          // Delete all current reports
          await apiRequest('DELETE', '/api/weekly-reports', {});
          
          // Delete AI summary
          if (currentWeekStart) {
            await apiRequest('DELETE', `/api/current-ai-summary/${currentWeekStart}`, {});
          }
          
          // Invalidate queries
          queryClient.invalidateQueries({ queryKey: ['/api/weekly-reports'] });
          queryClient.invalidateQueries({ queryKey: ['/api/saved-reports'] });
          queryClient.invalidateQueries({ queryKey: ['/api/current-ai-summary'] });
          queryClient.invalidateQueries({ queryKey: ['/api/reporting-week'] }); // Advance to next week
          
          // Clear local state
          setAiSummary(null);
          setTeamSummary(null);
          setSummaryGeneratedAt(null);
          setReportsAnalyzed(0);
          
          const summaryNote = leadershipSummaryToArchive ? (teamSummaryToArchive ? ' with AI summaries' : ' with leadership summary') : '';
          toast({
            title: 'Auto-Archive Complete',
            description: `Previous week's ${weeklyReports.length} reports have been archived${summaryNote} as 2 separate reports (Account + Team).`,
          });
        } catch (error: any) {
          console.error('Auto-archive failed:', error);
          const errorMessage = error.message || 'Unknown error occurred';
          toast({
            title: 'Auto-Archive Failed',
            description: `Failed to auto-archive: ${errorMessage}. Please use Force Archive manually.`,
            variant: 'destructive',
          });
        } finally {
          setIsAutoArchiving(false);
        }
      }
    };
    
    checkAndAutoArchive();
  }, [weeklyReports, aiSummary, currentWeekStart, toast]);

  // Format date to UTC string
  const formatUTC = (dateString: string) => {
    const date = new Date(dateString);
    return date.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
  };

  // Archive functionality
  const { refetch: refetchSavedReports } = useQuery<SavedReport[]>({ 
    queryKey: ['/api/saved-reports'] 
  });

  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/weekly-reports/ai-summary');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.summary) {
        setAiSummary(data.summary);
        setTeamSummary(data.teamSummary || null);
        setSummaryGeneratedAt(data.generatedAt);
        setReportsAnalyzed(data.reportsAnalyzed || 0);
        // Invalidate the cache so it will be reloaded when navigating back
        queryClient.invalidateQueries({ queryKey: ['/api/current-ai-summary'] });
        
        const teamSummaryNote = data.teamSummary ? ' (including team insights)' : '';
        toast({
          title: 'AI Summary Generated',
          description: `Analyzed ${data.reportsAnalyzed} reports successfully${teamSummaryNote}`,
        });
      } else {
        toast({
          title: 'No Reports to Analyze',
          description: data.message || 'Submit some reports first',
          variant: 'destructive',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Generate Summary',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleReportClick = (report: WeeklyReport) => {
    if (editingId !== report.id) {
      setSelectedReport(report);
      setShowReportDetailModal(true);
    }
  };

  const closeReportDetailModal = () => {
    setShowReportDetailModal(false);
    setSelectedReport(null);
  };

  useEffect(() => {
    if (externalHealthFilter && externalHealthFilter !== 'all') {
      setFilterHealth(externalHealthFilter);
      setTimeout(() => {
        const reportsSection = document.getElementById('weekly-reports-section');
        if (reportsSection) {
          reportsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [externalHealthFilter]);

  const getProjectStatus = (endDate: string | null | undefined): 'active' | 'renewal' | 'ended' => {
    if (!endDate) return 'renewal';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'ended';
    if (diffDays <= 60) return 'renewal';
    return 'active';
  };

  const projectStatusOptions = [
    { value: 'all', label: 'All Project Status' },
    { value: 'active', label: 'Active with no renewal soon' },
    { value: 'renewal', label: 'Active but renewal soon' },
    { value: 'ended', label: 'Ended' },
  ];

  const getLeadName = (leadId: string) => {
    return projectLeads.find((l) => l.id === leadId)?.name || 'Unknown';
  };

  const getProjectName = (projectId: string) => {
    return projects.find((p) => p.id === projectId)?.name || 'Unknown Project';
  };

  const getMemberName = (memberId: string) => {
    return teamMembers.find((m) => m.id === memberId)?.name || 'Unknown';
  };

  // Co-lead helper functions
  const getProjectLeadIds = (project: Project): string[] => {
    if (project.leadIds && project.leadIds.length > 0) {
      return project.leadIds;
    }
    return project.leadId ? [project.leadId] : [];
  };

  const getProjectLeadNames = (project: Project): string => {
    const leadIds = getProjectLeadIds(project);
    const names = leadIds
      .map(id => projectLeads.find(l => l.id === id)?.name)
      .filter(Boolean) as string[];
    return names.join(' & ') || 'Unknown';
  };

  const hasCoLeads = (project: Project): boolean => {
    return project.leadIds && project.leadIds.length > 1;
  };

  // Get the name of who submitted a report
  const getSubmittedByName = (report: WeeklyReport): string | null => {
    if (report.submittedByLeadId) {
      return getLeadName(report.submittedByLeadId);
    }
    return null;
  };

  // Check if any of the project's leads match the filter (supports co-leads)
  const doesReportMatchLeadFilter = (report: WeeklyReport): boolean => {
    if (filterLeads.size === 0) return true;
    const project = projects.find(p => p.id === report.projectId);
    if (!project) return filterLeads.has(report.leadId);
    const projectLeadIds = getProjectLeadIds(project);
    return projectLeadIds.some(leadId => filterLeads.has(leadId));
  };

  const startEdit = (report: WeeklyReport) => {
    if (report.status !== 'submitted') return;
    setEditingId(report.id);
    setEditData({
      progress: report.progress || '',
      challenges: report.challenges || '',
      nextWeek: report.nextWeek || '',
      healthStatus: report.healthStatus || '',
      teamMemberFeedback: (report.teamMemberFeedback as TeamMemberFeedback[]) || [],
    });
  };

  const editReportMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<WeeklyReport> }) => {
      return await apiRequest('PATCH', `/api/weekly-reports/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/weekly-reports'] });
      toast({ 
        title: 'Success', 
        description: 'Report updated successfully' 
      });
      setEditingId(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to update report',
        variant: 'destructive'
      });
    }
  });

  const saveEdit = (reportId: string) => {
    editReportMutation.mutate({ id: reportId, updates: editData });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  // Delete report state and mutation
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  
  const deleteReportMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/weekly-reports/${id}`);
      return await response.json() as { success: boolean; remainingSubmittedCount: number; projectStillHasReport: boolean };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/weekly-reports'] });
      
      if (data.projectStillHasReport) {
        toast({ 
          title: 'Duplicate Report Removed', 
          description: `Report deleted. Another report for this project still exists (${data.remainingSubmittedCount} remaining).`
        });
      } else {
        toast({ 
          title: 'Report Deleted', 
          description: 'The report has been removed and the project is now pending.' 
        });
      }
      setDeletingReportId(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to delete report',
        variant: 'destructive'
      });
    }
  });

  const toggleLeadFilter = (leadId: string) => {
    const newSet = new Set(filterLeads);
    if (newSet.has(leadId)) {
      newSet.delete(leadId);
    } else {
      newSet.add(leadId);
    }
    setFilterLeads(newSet);
  };

  const toggleMemberFilter = (memberId: string) => {
    const newSet = new Set(filterMembers);
    if (newSet.has(memberId)) {
      newSet.delete(memberId);
    } else {
      newSet.add(memberId);
    }
    setFilterMembers(newSet);
  };

  const clearAllFilters = () => {
    setFilterLeads(new Set());
    setFilterMembers(new Set());
    setFilterHealth('all');
    setFilterProjectStatus('all');
    setLeadSearch('');
    setMemberSearch('');
    onClearExternalFilter?.();
  };

  const handleHealthFilterChange = (value: string) => {
    setFilterHealth(value);
    onClearExternalFilter?.();
  };

  const activeFilterCount = 
    (filterLeads.size > 0 ? 1 : 0) + 
    (filterMembers.size > 0 ? 1 : 0) + 
    (filterHealth !== 'all' ? 1 : 0) +
    (filterProjectStatus !== 'all' ? 1 : 0);

  const filteredReports = weeklyReports.filter((report) => {
    if (report.status !== 'submitted') return false;
    // Use co-lead aware filter helper
    if (!doesReportMatchLeadFilter(report)) return false;
    if (filterHealth !== 'all' && report.healthStatus !== filterHealth) return false;
    
    const project = projects.find((p) => p.id === report.projectId);
    
    if (filterMembers.size > 0) {
      const projectMemberIds = project ? ((project.teamMembers as TeamMemberAssignment[]) || []).map(a => a.memberId) : [];
      if (!project || !projectMemberIds.some(id => filterMembers.has(id))) return false;
    }
    
    if (filterProjectStatus !== 'all') {
      if (!project) return false;
      const status = getProjectStatus(project.endDate);
      if (status !== filterProjectStatus) return false;
    }
    
    return true;
  });

  const onTrackCount = filteredReports.filter((r) => r.healthStatus === 'on-track').length;
  const atRiskCount = filteredReports.filter((r) => r.healthStatus === 'at-risk').length;
  const criticalCount = filteredReports.filter((r) => r.healthStatus === 'critical').length;

  const sortedReports = [...filteredReports].sort(
    (a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()
  );

  // Group reports by combined lead names - co-lead projects show as "Primary & Co-Lead"
  // This avoids duplicate display of reports (same pattern as SubmitReport.tsx)
  const groupedReportsByLead = sortedReports.reduce((acc, report) => {
    const project = projects.find(p => p.id === report.projectId);
    const combinedLeadName = project ? getProjectLeadNames(project) : getLeadName(report.leadId);
    
    if (!acc[combinedLeadName]) {
      acc[combinedLeadName] = [];
    }
    // Avoid duplicates
    if (!acc[combinedLeadName].some(r => r.id === report.id)) {
      acc[combinedLeadName].push(report);
    }
    
    return acc;
  }, {} as Record<string, WeeklyReport[]>);

  // Sort lead names alphabetically
  const sortedLeadNames = Object.keys(groupedReportsByLead).sort((a, b) => a.localeCompare(b));

  const filteredLeadsForSearch = projectLeads
    .filter(lead => lead.name.toLowerCase().includes(leadSearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const filteredMembersForSearch = teamMembers
    .filter(member => member.name.toLowerCase().includes(memberSearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Generate Account Reports CSV content
  const generateAccountReportsCSV = () => {
    const reportHeaders = ['Project', 'Lead(s)', 'Week Start', 'Health Status', 'Progress', 'Challenges', 'Next Week', 'Submitted', 'Submitted By'];
    const reportRows = sortedReports.map((report) => {
      const project = projects.find(p => p.id === report.projectId);
      const leadNames = project ? getProjectLeadNames(project) : getLeadName(report.leadId);
      const submittedBy = getSubmittedByName(report) || '';

      return [
        getProjectName(report.projectId),
        leadNames,
        report.weekStart,
        healthStatusConfig[report.healthStatus as keyof typeof healthStatusConfig]?.label || report.healthStatus || '',
        (report.progress || '').replace(/\n/g, ' '),
        (report.challenges || '').replace(/\n/g, ' '),
        (report.nextWeek || '').replace(/\n/g, ' '),
        new Date(report.submittedAt).toLocaleString(),
        submittedBy,
      ];
    });

    const lines = [
      reportHeaders.join(','),
      ...reportRows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ];

    return lines.join('\n');
  };

  // Generate Team Feedback CSV content
  const generateTeamFeedbackCSV = () => {
    const feedbackHeaders = ['Person Name', 'Role', 'Feedback'];
    const feedbackRows = peopleWithFeedback.map((person) => {
      const role = person.roles?.includes('project-lead') ? 'Team Lead' : 'Team Member';
      return [
        person.name,
        role,
        (person.feedback || '').replace(/\n/g, ' | '),
      ];
    });

    const lines = [
      feedbackHeaders.join(','),
      ...feedbackRows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ];

    return lines.join('\n');
  };

  // Generate combined CSV content for archive (includes both sections)
  const generateCSVContent = () => {
    const accountReportsSection = [
      '=== WEEKLY ACCOUNT REPORTS ===',
      generateAccountReportsCSV(),
    ];

    const teamFeedbackSection = [
      '',
      '',
      '=== SS/CMS TEAM FEEDBACK ===',
      generateTeamFeedbackCSV(),
    ];

    return [...accountReportsSection, ...teamFeedbackSection].join('\n');
  };

  const exportAccountReportsCSV = () => {
    const csvContent = generateAccountReportsCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `account_reports_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportTeamFeedbackCSV = () => {
    const csvContent = generateTeamFeedbackCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `team_feedback_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get current week's date range (Monday to Sunday) in UTC
  const getCurrentWeekDates = () => {
    const now = new Date();
    // Get UTC date components
    const utcYear = now.getUTCFullYear();
    const utcMonth = now.getUTCMonth();
    const utcDate = now.getUTCDate();
    const utcDayOfWeek = now.getUTCDay();
    
    // Calculate days to go back to reach Monday
    const daysToMonday = (utcDayOfWeek + 6) % 7;
    
    // Create pure UTC dates for Monday and Sunday midnight
    const mondayUTC = new Date(Date.UTC(utcYear, utcMonth, utcDate - daysToMonday, 0, 0, 0, 0));
    const sundayUTC = new Date(Date.UTC(utcYear, utcMonth, utcDate - daysToMonday + 6, 23, 59, 59, 999));
    
    // Format as YYYY-MM-DD
    const formatDate = (d: Date) => {
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    return { weekStart: formatDate(mondayUTC), weekEnd: formatDate(sundayUTC) };
  };

  // Get next Wednesday 00:00:00 UTC for auto-archive display
  const getNextWednesdayUTC = () => {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 3 = Wednesday
    let daysUntilWed = (3 - dayOfWeek + 7) % 7;
    if (daysUntilWed === 0) {
      // If today is Wednesday, check if past midnight UTC
      if (now.getUTCHours() >= 0) {
        daysUntilWed = 7; // Next Wednesday
      }
    }
    const nextWed = new Date(now);
    nextWed.setUTCDate(now.getUTCDate() + daysUntilWed);
    nextWed.setUTCHours(0, 0, 0, 0);
    return nextWed;
  };

  // Format next Wednesday for display
  const nextWednesday = getNextWednesdayUTC();
  const nextWedFormatted = nextWednesday.toLocaleDateString('en-US', { 
    weekday: 'long',
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    timeZone: 'UTC'
  });

  // Generate PDF content and return as base64 - reusable for both manual and auto archive
  const generatePDFBase64 = (reportsToUse: WeeklyReport[], weekEndDate: string, leadershipSummary: AISummary | null, teamSummaryParam: TeamSummary | null = null): string => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    // Helper function to safely convert AI summary items to strings
    const itemToString = (item: unknown): string => {
      if (typeof item === 'string') return item;
      if (!item || typeof item !== 'object') return '';
      const obj = item as Record<string, unknown>;
      // Handle various item formats
      if (obj.project && obj.achievement) return `${obj.project}: ${obj.achievement}`;
      if (obj.project && obj.issue) return `${obj.project}: ${obj.issue}`;
      if (obj.project && obj.focus) return `${obj.project}: ${obj.focus}`;
      if (obj.memberName && obj.achievement) return `${obj.memberName}: ${obj.achievement}`;
      if (obj.memberName && obj.highlight) return `${obj.memberName}: ${obj.highlight}`;
      if (obj.area && obj.suggestedSupport) return `${obj.area}: ${obj.suggestedSupport}`;
      if (obj.concern) return String(obj.concern);
      if (obj.observation) return String(obj.observation);
      // Fallback: try to stringify
      try {
        return JSON.stringify(obj);
      } catch {
        return '';
      }
    };
    
    const colors = {
      navy: [15, 23, 42],
      navyLight: [30, 41, 59],
      primary: [99, 102, 241],
      success: [34, 197, 94],
      warning: [245, 158, 11],
      destructive: [239, 68, 68],
      white: [255, 255, 255],
      muted: [148, 163, 184],
      border: [51, 65, 85],
    };

    doc.setFillColor(...colors.navy as [number, number, number]);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setFillColor(...colors.primary as [number, number, number]);
    doc.rect(0, 35, pageWidth, 2, 'F');
    
    doc.setTextColor(...colors.white as [number, number, number]);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('CMS & SS Leadership Report', 14, 18);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.muted as [number, number, number]);
    const weekEndFormatted = new Date(weekEndDate + 'T00:00:00').toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    doc.text(`Weekly Delivery Status Overview - Week Ending ${weekEndFormatted}`, 14, 26);
    
    doc.setTextColor(...colors.white as [number, number, number]);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 14, 18, { align: 'right' });

    let currentY = 45;

    // Status metrics cards
    const pdfOnTrack = reportsToUse.filter(r => r.healthStatus === 'on-track').length;
    const pdfAtRisk = reportsToUse.filter(r => r.healthStatus === 'at-risk').length;
    const pdfCritical = reportsToUse.filter(r => r.healthStatus === 'critical').length;
    
    const metrics = [
      { label: 'On Track', value: pdfOnTrack, color: colors.success },
      { label: 'Needs Attention', value: pdfAtRisk, color: colors.warning },
      { label: 'Critical', value: pdfCritical, color: colors.destructive },
    ];

    const cardWidth = (pageWidth - 28 - 8) / 3;
    metrics.forEach((metric, idx) => {
      const x = 14 + (idx * (cardWidth + 4));
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, currentY, cardWidth, 16, 2, 2, 'F');
      doc.setFillColor(...metric.color as [number, number, number]);
      doc.rect(x, currentY, 3, 16, 'F');
      doc.setTextColor(...metric.color as [number, number, number]);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(String(metric.value), x + 8, currentY + 10);
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(metric.label, x + 20, currentY + 10);
    });

    currentY += 24;

    // Leadership AI Summary section if available
    if (leadershipSummary) {
      doc.setFillColor(...colors.navyLight as [number, number, number]);
      doc.roundedRect(14, currentY, pageWidth - 28, 8, 2, 2, 'F');
      doc.setTextColor(...colors.primary as [number, number, number]);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Leadership Insights (AI-Powered)', 18, currentY + 5.5);
      currentY += 12;
      
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'normal');
      const summaryLines = doc.splitTextToSize(leadershipSummary.executiveSummary, pageWidth - 32);
      doc.text(summaryLines, 14, currentY);
      currentY += summaryLines.length * 4 + 4;
      
      // Add key points in two columns
      const halfWidth = (pageWidth - 32) / 2;
      const leftX = 14;
      const rightX = 14 + halfWidth + 4;
      
      // Left column: Achievements & Highlights
      if ((leadershipSummary.keyAchievements?.length ?? 0) > 0 || (leadershipSummary.weekHighlights?.length ?? 0) > 0) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.success as [number, number, number]);
        doc.text('Key Achievements:', leftX, currentY);
        currentY += 3;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        (leadershipSummary.keyAchievements || []).slice(0, 3).forEach(item => {
          const itemText = itemToString(item);
          if (itemText) {
            const itemLines = doc.splitTextToSize(`• ${itemText}`, halfWidth - 4);
            doc.text(itemLines, leftX, currentY);
            currentY += itemLines.length * 3;
          }
        });
      }
      
      // Right column: Attention Needed & Critical Issues (position tracked separately)
      let rightY = currentY - ((leadershipSummary.keyAchievements || []).slice(0, 3).length * 3) - 3;
      if ((leadershipSummary.attentionNeeded?.length ?? 0) > 0 || (leadershipSummary.criticalIssues?.length ?? 0) > 0) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.warning as [number, number, number]);
        doc.text('Needs Attention:', rightX, rightY);
        rightY += 3;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        (leadershipSummary.attentionNeeded || []).slice(0, 3).forEach(item => {
          const itemText = itemToString(item);
          if (itemText) {
            const itemLines = doc.splitTextToSize(`• ${itemText}`, halfWidth - 4);
            doc.text(itemLines, rightX, rightY);
            rightY += itemLines.length * 3;
          }
        });
      }
      
      currentY = Math.max(currentY, rightY) + 4;
    }
    
    // SS/CMS Team Feedback Summary section if available
    if (teamSummaryParam) {
      doc.setFillColor(...colors.navyLight as [number, number, number]);
      doc.roundedRect(14, currentY, pageWidth - 28, 8, 2, 2, 'F');
      doc.setTextColor(59, 130, 246); // Blue color for team
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('SS/CMS Team Feedback Summary (AI-Powered)', 18, currentY + 5.5);
      currentY += 12;
      
      // Team morale indicator
      const moraleColors: Record<string, [number, number, number]> = {
        'positive': colors.success as [number, number, number],
        'mixed': colors.warning as [number, number, number],
        'concerning': colors.destructive as [number, number, number]
      };
      const moraleColor = moraleColors[teamSummaryParam.overallTeamMorale] || colors.muted as [number, number, number];
      doc.setFontSize(8);
      doc.setTextColor(...moraleColor);
      doc.setFont('helvetica', 'bold');
      const moraleLabel = teamSummaryParam.overallTeamMorale === 'positive' ? 'Positive' : 
                          teamSummaryParam.overallTeamMorale === 'mixed' ? 'Mixed' : 'Concerning';
      doc.text(`Team Morale: ${moraleLabel}`, 14, currentY);
      currentY += 4;
      
      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'normal');
      const teamSummaryLines = doc.splitTextToSize(teamSummaryParam.teamSummary, pageWidth - 32);
      doc.text(teamSummaryLines, 14, currentY);
      currentY += teamSummaryLines.length * 4 + 4;
      
      // Team highlights and concerns
      const halfWidth = (pageWidth - 32) / 2;
      const leftX = 14;
      const rightX = 14 + halfWidth + 4;
      
      let teamLeftY = currentY;
      let teamRightY = currentY;
      
      // Left: Recognition & Highlights
      if ((teamSummaryParam.teamHighlights?.length ?? 0) > 0 || (teamSummaryParam.recognitionOpportunities?.length ?? 0) > 0) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.success as [number, number, number]);
        doc.text('Recognition Opportunities:', leftX, teamLeftY);
        teamLeftY += 3;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        (teamSummaryParam.recognitionOpportunities || []).slice(0, 3).forEach(item => {
          const itemText = itemToString(item);
          if (itemText) {
            const itemLines = doc.splitTextToSize(`• ${itemText}`, halfWidth - 4);
            doc.text(itemLines, leftX, teamLeftY);
            teamLeftY += itemLines.length * 3;
          }
        });
      }
      
      // Right: Concerns & Support Needed
      if ((teamSummaryParam.teamConcerns?.length ?? 0) > 0 || (teamSummaryParam.supportNeeded?.length ?? 0) > 0) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.warning as [number, number, number]);
        doc.text('Support Needed:', rightX, teamRightY);
        teamRightY += 3;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        (teamSummaryParam.supportNeeded || []).slice(0, 3).forEach(item => {
          const itemText = itemToString(item);
          if (itemText) {
            const itemLines = doc.splitTextToSize(`• ${itemText}`, halfWidth - 4);
            doc.text(itemLines, rightX, teamRightY);
            teamRightY += itemLines.length * 3;
          }
        });
      }
      
      currentY = Math.max(teamLeftY, teamRightY) + 4;
    }

    // Reports table
    const tableData = reportsToUse.map((report) => {
      const project = projects.find((p) => p.id === report.projectId);
      const feedback = report.teamMemberFeedback as TeamMemberFeedback[] | null;
      const feedbackText = feedback && feedback.length > 0
        ? feedback.map((f) => `${getMemberName(f.memberId)}: ${f.feedback}`).join('\n')
        : '-';
      
      // Use co-lead names if available
      const leadNames = project ? getProjectLeadNames(project) : getLeadName(report.leadId);
      
      return [
        getProjectName(report.projectId),
        project?.customer || '-',
        leadNames,
        healthStatusConfig[report.healthStatus as keyof typeof healthStatusConfig]?.label || '-',
        report.progress || '-',
        report.challenges || '-',
        report.nextWeek || '-',
        feedbackText,
      ];
    });

    autoTable(doc, {
      head: [['Project', 'Customer', 'Lead(s)', 'Health', 'Progress', 'Challenges', 'Next Week', 'Feedback']],
      body: tableData,
      startY: currentY,
      theme: 'plain',
      styles: { fontSize: 7, cellPadding: 3, lineColor: [226, 232, 240], lineWidth: 0.5 },
      headStyles: { fillColor: [...colors.navyLight as [number, number, number]], textColor: [...colors.white as [number, number, number]], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 25 },
        2: { cellWidth: 22 },
        3: { cellWidth: 22 },
        4: { cellWidth: 40 },
        5: { cellWidth: 40 },
        6: { cellWidth: 40 },
        7: { cellWidth: 40 },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const status = data.cell.raw as string;
          if (status === 'On Track') {
            data.cell.styles.textColor = colors.success as [number, number, number];
            data.cell.styles.fontStyle = 'bold';
          } else if (status === 'Needs Attention') {
            data.cell.styles.textColor = colors.warning as [number, number, number];
            data.cell.styles.fontStyle = 'bold';
          } else if (status === 'Critical') {
            data.cell.styles.textColor = colors.destructive as [number, number, number];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      didDrawPage: (data) => {
        doc.setFillColor(...colors.navy as [number, number, number]);
        doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
        doc.setFontSize(8);
        doc.setTextColor(...colors.muted as [number, number, number]);
        doc.text('CMS & SS Leadership Report', 14, pageHeight - 5);
        doc.text(`Page ${data.pageNumber}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
        doc.text(new Date().toLocaleDateString(), pageWidth - 14, pageHeight - 5, { align: 'right' });
      },
    });

    return doc.output('datauristring').split(',')[1];
  };

  // Generate CSV content for a given set of reports with optional AI summaries
  const generateCSVForReports = (reportsToUse: WeeklyReport[], leadershipSummary: AISummary | null = null, teamSummaryParam: TeamSummary | null = null): string => {
    const lines: string[] = [];
    
    // Add Leadership Summary section if available
    if (leadershipSummary) {
      const formatItems = (items: unknown[] | undefined) => {
        if (!items) return '';
        return items.map(item => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object' && 'project' in item && 'achievement' in item) 
            return `${(item as {project: string}).project}: ${(item as {achievement: string}).achievement}`;
          if (item && typeof item === 'object' && 'project' in item && 'focus' in item) 
            return `${(item as {project: string}).project}: ${(item as {focus: string}).focus}`;
          return '';
        }).join('; ').replace(/"/g, '""');
      };
      
      lines.push('=== LEADERSHIP INSIGHTS (AI-POWERED) ===');
      lines.push(`"Overall Health","${leadershipSummary.overallHealth === 'on-track' ? 'On Track' : leadershipSummary.overallHealth === 'needs-attention' ? 'Needs Attention' : 'Critical'}"`);
      lines.push(`"Executive Summary","${leadershipSummary.executiveSummary.replace(/"/g, '""')}"`);
      lines.push(`"Key Achievements","${formatItems(leadershipSummary.keyAchievements)}"`);
      lines.push(`"Week Highlights","${(leadershipSummary.weekHighlights || []).join('; ').replace(/"/g, '""')}"`);
      lines.push(`"Needs Attention","${(leadershipSummary.attentionNeeded || []).join('; ').replace(/"/g, '""')}"`);
      lines.push(`"Critical Issues","${(leadershipSummary.criticalIssues || []).join('; ').replace(/"/g, '""')}"`);
      lines.push(`"Upcoming Focus","${formatItems(leadershipSummary.upcomingFocus)}"`);
      lines.push('');
    }
    
    // Add SS/CMS Team Feedback Summary section if available
    if (teamSummaryParam) {
      const formatTeamItems = (items: unknown[] | undefined) => {
        if (!items) return '';
        return items.map(item => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object' && 'memberName' in item && 'achievement' in item) 
            return `${(item as {memberName: string}).memberName}: ${(item as {achievement: string}).achievement}`;
          if (item && typeof item === 'object' && 'memberName' in item && 'highlight' in item) 
            return `${(item as {memberName: string}).memberName}: ${(item as {highlight: string}).highlight}`;
          if (item && typeof item === 'object' && 'area' in item && 'suggestedSupport' in item) 
            return `${(item as {area: string}).area}: ${(item as {suggestedSupport: string}).suggestedSupport}`;
          if (item && typeof item === 'object' && 'concern' in item) 
            return (item as {concern: string}).concern;
          return '';
        }).join('; ').replace(/"/g, '""');
      };
      
      lines.push('=== SS/CMS TEAM FEEDBACK SUMMARY (AI-POWERED) ===');
      const moraleLabel = teamSummaryParam.overallTeamMorale === 'positive' ? 'Positive' : 
                          teamSummaryParam.overallTeamMorale === 'mixed' ? 'Mixed' : 'Concerning';
      lines.push(`"Team Morale","${moraleLabel}"`);
      lines.push(`"SS/CMS Team Feedback Summary","${teamSummaryParam.teamSummary.replace(/"/g, '""')}"`);
      lines.push(`"Team Highlights","${formatTeamItems(teamSummaryParam.teamHighlights)}"`);
      lines.push(`"Recognition Opportunities","${formatTeamItems(teamSummaryParam.recognitionOpportunities)}"`);
      lines.push(`"Team Concerns","${formatTeamItems(teamSummaryParam.teamConcerns)}"`);
      lines.push(`"Support Needed","${formatTeamItems(teamSummaryParam.supportNeeded)}"`);
      lines.push('');
    }
    
    // Add Reports section
    lines.push('=== WEEKLY REPORTS ===');
    const headers = ['Project', 'Lead', 'Week Start', 'Health Status', 'Progress', 'Challenges', 'Next Week', 'Team Feedback', 'Submitted'];
    lines.push(headers.join(','));
    
    const rows = reportsToUse.map((report) => {
      const feedback = report.teamMemberFeedback as TeamMemberFeedback[] | null;
      const feedbackText = feedback && feedback.length > 0
        ? feedback.map((f) => `${getMemberName(f.memberId)}: ${f.feedback}`).join('; ')
        : 'None';

      return [
        getProjectName(report.projectId),
        getLeadName(report.leadId),
        report.weekStart,
        healthStatusConfig[report.healthStatus as keyof typeof healthStatusConfig]?.label || report.healthStatus || '',
        (report.progress || '').replace(/\n/g, ' '),
        (report.challenges || '').replace(/\n/g, ' '),
        (report.nextWeek || '').replace(/\n/g, ' '),
        feedbackText.replace(/\n/g, ' '),
        new Date(report.submittedAt).toLocaleString(),
      ];
    });

    rows.forEach(row => {
      lines.push(row.map((cell) => `"${cell}"`).join(','));
    });

    return lines.join('\n');
  };

  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    // Premium color palette matching web UI
    const colors = {
      navy: [15, 23, 42],        // Dark navy background
      navyLight: [30, 41, 59],   // Lighter navy for sections
      primary: [99, 102, 241],   // Indigo/primary
      success: [34, 197, 94],    // Green for on-track
      warning: [245, 158, 11],   // Amber for needs attention
      destructive: [239, 68, 68], // Red for critical
      white: [255, 255, 255],
      muted: [148, 163, 184],    // Muted text
      border: [51, 65, 85],      // Border color
    };

    // Helper function to convert AI summary items to text strings
    const formatAIItem = (item: unknown): string => {
      if (typeof item === 'string') return item;
      if (!item || typeof item !== 'object') return '';
      const obj = item as Record<string, unknown>;
      // AchievementItem: project, achievement, impact
      if ('achievement' in obj && 'project' in obj) {
        return `${obj.project}: ${obj.achievement}`;
      }
      // UpcomingFocusItem: project, focus, priority
      if ('focus' in obj && 'project' in obj) {
        return `${obj.project}: ${obj.focus}`;
      }
      // AttentionItem: project, issue, recommendedAction
      if ('issue' in obj && 'project' in obj) {
        return `${obj.project}: ${obj.issue}`;
      }
      return '';
    };

    // Premium header with gradient effect
    doc.setFillColor(...colors.navy as [number, number, number]);
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    // Header accent line
    doc.setFillColor(...colors.primary as [number, number, number]);
    doc.rect(0, 35, pageWidth, 2, 'F');
    
    // Title
    doc.setTextColor(...colors.white as [number, number, number]);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('CMS & SS Leadership Report', 14, 18);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.muted as [number, number, number]);
    // Get week dates from the component's currentWeekStart (derived from all reports)
    // Falls back to getCurrentWeekDates() only if no reports exist
    const pdfWeekStart = currentWeekStart || getCurrentWeekDates().weekStart;
    const pdfWeekStartDate = new Date(pdfWeekStart + 'T00:00:00Z');
    const pdfWeekEndDate = new Date(pdfWeekStartDate);
    pdfWeekEndDate.setUTCDate(pdfWeekStartDate.getUTCDate() + 6);
    const pdfWeekEnd = pdfWeekEndDate.toISOString().split('T')[0];
    const weekEndFormatted = new Date(pdfWeekEnd + 'T00:00:00').toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    doc.text(`Weekly Delivery Status Overview - Week Ending ${weekEndFormatted}`, 14, 26);
    
    doc.setTextColor(...colors.white as [number, number, number]);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 14, 18, { align: 'right' });

    let currentY = 45;

    // Helper to render text item for AI summaries
    const renderTextItem = (item: unknown): string => {
      if (typeof item === 'string') return item;
      if (!item || typeof item !== 'object') return '';
      const obj = item as Record<string, unknown>;
      if (obj.project && obj.achievement) return `${obj.project}: ${obj.achievement}`;
      if (obj.project && obj.focus) return `${obj.project} (${obj.priority || 'medium'}): ${obj.focus}`;
      if (obj.project && obj.issue) return `${obj.project}: ${obj.issue}`;
      return '';
    };

    // Helper for team items
    const renderTeamItem = (item: unknown): string => {
      if (typeof item === 'string') return item;
      if (!item || typeof item !== 'object') return '';
      const obj = item as Record<string, unknown>;
      if (obj.memberName && obj.achievement) return `${obj.memberName}: ${obj.achievement}`;
      if (obj.memberName && obj.highlight) return `${obj.memberName} (${obj.project || ''}): ${obj.highlight}`;
      if (obj.memberName && obj.opportunity) return `${obj.memberName}: ${obj.opportunity}`;
      if (obj.concern) return `${obj.concern} (${obj.project || ''})`;
      if (obj.area && obj.suggestedSupport) return `${obj.area}: ${obj.suggestedSupport}`;
      if (obj.observation) return String(obj.observation);
      if (obj.indicator) return String(obj.indicator);
      return '';
    };

    // Purple color for development opportunities
    const colorsPurple: [number, number, number] = [139, 92, 246];

    // Comprehensive Leadership Summary Section (if available)
    if (aiSummary) {
      // Section header
      doc.setFillColor(...colors.navyLight as [number, number, number]);
      doc.roundedRect(14, currentY, pageWidth - 28, 10, 2, 2, 'F');
      doc.setTextColor(...colors.primary as [number, number, number]);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Leadership Insights (AI-Powered)', 18, currentY + 7);
      
      // Overall health badge
      const healthColors: Record<string, [number, number, number]> = {
        'on-track': colors.success as [number, number, number],
        'needs-attention': colors.warning as [number, number, number],
        'critical': colors.destructive as [number, number, number],
      };
      const healthColor = healthColors[aiSummary.overallHealth] || colors.muted as [number, number, number];
      const healthLabel = aiSummary.overallHealth === 'on-track' ? 'On Track' : 
                         aiSummary.overallHealth === 'needs-attention' ? 'Needs Attention' : 'Critical';
      
      doc.setFillColor(...healthColor);
      doc.roundedRect(pageWidth - 14 - 45, currentY + 2, 43, 6, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.text(healthLabel, pageWidth - 14 - 23, currentY + 6, { align: 'center' });
      
      currentY += 14;
      
      // Executive Summary
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const summaryLines = doc.splitTextToSize(aiSummary.executiveSummary, pageWidth - 32);
      doc.text(summaryLines, 14, currentY);
      currentY += summaryLines.length * 4 + 4;

      // Portfolio Health Breakdown (comprehensive format)
      if (aiSummary.portfolioHealthBreakdown) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text('Portfolio Health Breakdown:', 14, currentY);
        currentY += 5;
        
        const phb = aiSummary.portfolioHealthBreakdown;
        const maxWidth = pageWidth - 36;
        
        // On Track
        const onTrackText = `On Track (${phb.onTrack.count}): ${phb.onTrack.projects.slice(0, 5).join(', ')}${phb.onTrack.projects.length > 5 ? '...' : ''}`;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colors.success as [number, number, number]);
        const onTrackLines = doc.splitTextToSize(onTrackText, maxWidth);
        doc.text(onTrackLines, 18, currentY);
        currentY += onTrackLines.length * 3.2 + 1;
        
        // Needs Attention
        const needsAttentionText = `Needs Attention (${phb.needsAttention.count}): ${phb.needsAttention.projects.slice(0, 5).join(', ')}${phb.needsAttention.projects.length > 5 ? '...' : ''}`;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colors.warning as [number, number, number]);
        const needsAttentionLines = doc.splitTextToSize(needsAttentionText, maxWidth);
        doc.text(needsAttentionLines, 18, currentY);
        currentY += needsAttentionLines.length * 3.2 + 1;
        
        // Critical
        const criticalText = `Critical (${phb.critical.count}): ${phb.critical.projects.slice(0, 5).join(', ')}${phb.critical.projects.length > 5 ? '...' : ''}`;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colors.destructive as [number, number, number]);
        const criticalLines = doc.splitTextToSize(criticalText, maxWidth);
        doc.text(criticalLines, 18, currentY);
        currentY += criticalLines.length * 3.2 + 3;
      }

      // Immediate Attention Required (comprehensive format)
      if (aiSummary.immediateAttentionRequired && aiSummary.immediateAttentionRequired.length > 0) {
        const attentionItems = aiSummary.immediateAttentionRequired.slice(0, 3);
        const maxWidth = pageWidth - 40;
        
        // Calculate height needed for box
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        let boxHeight = 10;
        attentionItems.forEach((item) => {
          const itemText = `• ${item.project} (${item.lead}): ${item.issue}`;
          const itemLines = doc.splitTextToSize(itemText, maxWidth);
          boxHeight += itemLines.length * 3.2 + 1;
        });
        
        doc.setFillColor(255, 240, 240);
        doc.roundedRect(14, currentY, pageWidth - 28, boxHeight, 2, 2, 'F');
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.destructive as [number, number, number]);
        doc.text('Immediate Attention Required:', 18, currentY + 5);
        currentY += 9;
        
        attentionItems.forEach((item) => {
          const itemText = `• ${item.project} (${item.lead}): ${item.issue}`;
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(80, 80, 80);
          const itemLines = doc.splitTextToSize(itemText, maxWidth);
          doc.text(itemLines, 18, currentY);
          currentY += itemLines.length * 3.2 + 1;
        });
        currentY += 3;
      }
      
      // Key sections in compact format
      const sections = [
        { title: 'Key Achievements', items: aiSummary.keyAchievements, color: colors.success },
        { title: 'Week Highlights', items: aiSummary.weekHighlights, color: colors.primary },
        { title: 'Needs Attention', items: aiSummary.attentionNeeded, color: colors.warning },
        { title: 'Upcoming Focus', items: aiSummary.upcomingFocus, color: colors.primary },
        { title: 'Critical Issues', items: aiSummary.criticalIssues, color: colors.destructive },
      ].filter(s => s.items && s.items.length > 0);
      
      sections.forEach(section => {
        doc.setFillColor(...section.color as [number, number, number]);
        doc.circle(16, currentY + 1.5, 1.2, 'F');
        
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(section.title, 20, currentY + 2);
        currentY += 4;
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(7);
        (section.items || []).slice(0, 3).forEach((item) => {
          const itemText = renderTextItem(item);
          if (itemText) {
            const lines = doc.splitTextToSize(`• ${itemText}`, pageWidth - 36);
            doc.text(lines, 20, currentY);
            currentY += lines.length * 3;
          }
        });
        currentY += 2;
      });

      // Cross-Project Patterns (comprehensive format)
      if (aiSummary.crossProjectPatterns) {
        if (aiSummary.crossProjectPatterns.commonChallenges?.length > 0) {
          doc.setFillColor(...colors.warning as [number, number, number]);
          doc.circle(16, currentY + 1.5, 1.2, 'F');
          doc.setTextColor(40, 40, 40);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.text('Common Challenges', 20, currentY + 2);
          currentY += 4;
          
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(80, 80, 80);
          doc.setFontSize(7);
          aiSummary.crossProjectPatterns.commonChallenges.slice(0, 2).forEach((item) => {
            const lines = doc.splitTextToSize(`• ${item}`, pageWidth - 36);
            doc.text(lines, 20, currentY);
            currentY += lines.length * 3;
          });
          currentY += 2;
        }
      }

      // Recommended Leadership Actions (comprehensive format)
      if (aiSummary.recommendedLeadershipActions && aiSummary.recommendedLeadershipActions.length > 0) {
        doc.setFillColor(...colors.primary as [number, number, number]);
        doc.circle(16, currentY + 1.5, 1.2, 'F');
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Recommended Leadership Actions', 20, currentY + 2);
        currentY += 4;
        
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        aiSummary.recommendedLeadershipActions.slice(0, 3).forEach((item) => {
          const priorityColor = item.priority === 'high' ? colors.destructive : colors.warning;
          doc.setTextColor(...priorityColor as [number, number, number]);
          doc.text(`[${item.priority.toUpperCase()}]`, 20, currentY);
          doc.setTextColor(80, 80, 80);
          const lines = doc.splitTextToSize(item.action, pageWidth - 55);
          doc.text(lines, 38, currentY);
          currentY += lines.length * 3 + 0.5;
        });
        currentY += 3;
      }
    }

    // SS/CMS Team Feedback Summary Section (if available)
    if (teamSummary) {
      // Check if we need a new page
      if (currentY > pageHeight - 50) {
        doc.addPage();
        currentY = 20;
      }
      
      // Section header
      doc.setFillColor(...colors.navyLight as [number, number, number]);
      doc.roundedRect(14, currentY, pageWidth - 28, 10, 2, 2, 'F');
      doc.setTextColor(59, 130, 246);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('SS/CMS Team Feedback Summary (AI-Powered)', 18, currentY + 7);
      
      // Morale badge
      const moraleColors: Record<string, [number, number, number]> = {
        'positive': colors.success as [number, number, number],
        'mixed': colors.warning as [number, number, number],
        'concerning': colors.destructive as [number, number, number]
      };
      const moraleColor = moraleColors[teamSummary.overallTeamMorale] || colors.muted as [number, number, number];
      const moraleLabel = teamSummary.overallTeamMorale === 'positive' ? 'Positive' : 
                          teamSummary.overallTeamMorale === 'mixed' ? 'Mixed' : 'Concerning';
      
      doc.setFillColor(...moraleColor);
      doc.roundedRect(pageWidth - 14 - 50, currentY + 2, 48, 6, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.text(`Morale: ${moraleLabel}`, pageWidth - 14 - 26, currentY + 6, { align: 'center' });
      
      currentY += 14;
      
      // SS/CMS Team Feedback Summary text
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const teamSummaryLines = doc.splitTextToSize(teamSummary.teamSummary, pageWidth - 32);
      doc.text(teamSummaryLines, 14, currentY);
      currentY += teamSummaryLines.length * 4 + 4;
      
      // Team sections
      const teamSections = [
        { title: 'Recognition Opportunities', items: teamSummary.recognitionOpportunities, color: colors.success },
        { title: 'Team Highlights', items: teamSummary.teamHighlights, color: colors.primary },
        { title: 'Team Concerns', items: teamSummary.teamConcerns, color: colors.warning },
        { title: 'Support Needed', items: teamSummary.supportNeeded, color: colors.destructive },
        { title: 'Workload Observations', items: teamSummary.workloadObservations, color: colors.primary },
        { title: 'Development Opportunities', items: teamSummary.developmentOpportunities, color: colorsPurple },
        { title: 'Retention Risks', items: teamSummary.retentionRisks, color: colors.destructive },
      ].filter(s => s.items && s.items.length > 0);
      
      teamSections.forEach(section => {
        // Check for page break
        if (currentY > pageHeight - 25) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.setFillColor(...section.color as [number, number, number]);
        doc.circle(16, currentY + 1.5, 1.2, 'F');
        
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(section.title, 20, currentY + 2);
        currentY += 4;
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(7);
        (section.items || []).slice(0, 3).forEach((item) => {
          const itemText = renderTeamItem(item);
          if (itemText) {
            const lines = doc.splitTextToSize(`• ${itemText}`, pageWidth - 36);
            doc.text(lines, 20, currentY);
            currentY += lines.length * 3;
          }
        });
        currentY += 2;
      });

      // Recommended HR Actions (comprehensive format)
      if (teamSummary.recommendedHRActions && teamSummary.recommendedHRActions.length > 0) {
        if (currentY > pageHeight - 25) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.setFillColor(...colors.primary as [number, number, number]);
        doc.circle(16, currentY + 1.5, 1.2, 'F');
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Recommended HR Actions', 20, currentY + 2);
        currentY += 4;
        
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        teamSummary.recommendedHRActions.slice(0, 3).forEach((item) => {
          const priorityColor = item.priority === 'high' ? colors.destructive : 
                               item.priority === 'medium' ? colors.warning : colors.muted;
          doc.setTextColor(...priorityColor as [number, number, number]);
          doc.text(`[${item.priority.toUpperCase()}]`, 20, currentY);
          doc.setTextColor(80, 80, 80);
          const lines = doc.splitTextToSize(item.action, pageWidth - 55);
          doc.text(lines, 38, currentY);
          currentY += lines.length * 3 + 0.5;
        });
        currentY += 3;
      }
    }

    // Separator line before report summary
    if (aiSummary || teamSummary) {
      doc.setDrawColor(...colors.border as [number, number, number]);
      doc.setLineWidth(0.3);
      doc.line(14, currentY, pageWidth - 14, currentY);
      currentY += 6;
    }

    // Health Status Summary Cards
    doc.setFillColor(...colors.navyLight as [number, number, number]);
    doc.roundedRect(14, currentY, pageWidth - 28, 10, 2, 2, 'F');
    
    doc.setTextColor(...colors.primary as [number, number, number]);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Report Summary', 18, currentY + 7);
    doc.setTextColor(...colors.muted as [number, number, number]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${sortedReports.length} Total Reports`, pageWidth - 18, currentY + 7, { align: 'right' });
    
    currentY += 14;

    // Status metric boxes
    const metricWidth = 55;
    const metricHeight = 18;
    const metricSpacing = 8;
    const startX = 14;
    
    const metrics = [
      { label: 'On Track', count: onTrackCount, color: colors.success },
      { label: 'Needs Attention', count: atRiskCount, color: colors.warning },
      { label: 'Critical', count: criticalCount, color: colors.destructive },
    ];
    
    metrics.forEach((metric, idx) => {
      const x = startX + idx * (metricWidth + metricSpacing);
      
      // Card background
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(x, currentY, metricWidth, metricHeight, 2, 2, 'F');
      
      // Left border accent
      doc.setFillColor(...metric.color as [number, number, number]);
      doc.rect(x, currentY + 2, 2, metricHeight - 4, 'F');
      
      // Count
      doc.setTextColor(...metric.color as [number, number, number]);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(String(metric.count), x + 8, currentY + 11);
      
      // Label
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(metric.label, x + 8, currentY + 16);
    });
    
    currentY += metricHeight + 8;

    // Reports table with premium styling
    const tableData = sortedReports.map((report) => {
      const project = projects.find(p => p.id === report.projectId);
      const feedback = report.teamMemberFeedback as TeamMemberFeedback[] | null;
      const feedbackText = feedback && feedback.length > 0
        ? feedback.map((f) => `${getMemberName(f.memberId)}: ${f.feedback}`).join('; ')
        : '-';

      // Use co-lead names if available
      const leadNames = project ? getProjectLeadNames(project) : getLeadName(report.leadId);

      return [
        getProjectName(report.projectId),
        leadNames,
        report.weekStart,
        healthStatusConfig[report.healthStatus as keyof typeof healthStatusConfig]?.label || report.healthStatus || '',
        report.progress || '-',
        report.challenges || '-',
        report.nextWeek || '-',
        feedbackText,
      ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [['Project', 'Lead(s)', 'Week', 'Status', 'Progress', 'Challenges', 'Next Week', 'Feedback']],
      body: tableData,
      styles: { 
        fontSize: 7.5, 
        cellPadding: 3, 
        overflow: 'linebreak',
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      headStyles: { 
        fillColor: colors.navy as [number, number, number], 
        textColor: [255, 255, 255], 
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 35, fontStyle: 'bold' },
        1: { cellWidth: 25 },
        2: { cellWidth: 22 },
        3: { cellWidth: 26 },
        4: { cellWidth: 45 },
        5: { cellWidth: 45 },
        6: { cellWidth: 45 },
        7: { cellWidth: 35 },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const status = data.cell.raw as string;
          if (status === 'On Track') {
            data.cell.styles.textColor = colors.success as [number, number, number];
            data.cell.styles.fontStyle = 'bold';
          } else if (status === 'Needs Attention') {
            data.cell.styles.textColor = colors.warning as [number, number, number];
            data.cell.styles.fontStyle = 'bold';
          } else if (status === 'Critical') {
            data.cell.styles.textColor = colors.destructive as [number, number, number];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      didDrawPage: (data) => {
        // Footer with page number
        doc.setFillColor(...colors.navy as [number, number, number]);
        doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
        
        doc.setFontSize(8);
        doc.setTextColor(...colors.muted as [number, number, number]);
        doc.text(
          `CMS & SS Leadership Report`,
          14,
          pageHeight - 5,
        );
        doc.text(
          `Page ${data.pageNumber}`,
          pageWidth / 2,
          pageHeight - 5,
          { align: 'center' }
        );
        doc.text(
          new Date().toLocaleDateString(),
          pageWidth - 14,
          pageHeight - 5,
          { align: 'right' }
        );
      },
    });

    doc.save(`cms_ss_leadership_report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Export Leadership Summary as standalone PDF (AI Insights only - no team feedback)
  const exportLeadershipSummaryPDF = () => {
    if (!aiSummary) {
      toast({
        title: 'No Leadership Summary Available',
        description: 'Generate an AI summary first before downloading',
        variant: 'destructive',
      });
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait' });
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    const colors = {
      navy: [15, 23, 42],
      navyLight: [30, 41, 59],
      primary: [99, 102, 241],
      success: [34, 197, 94],
      warning: [245, 158, 11],
      destructive: [239, 68, 68],
      white: [255, 255, 255],
      muted: [148, 163, 184],
      border: [51, 65, 85],
      purple: [139, 92, 246],
    };

    // Header
    doc.setFillColor(...colors.navy as [number, number, number]);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setFillColor(...colors.primary as [number, number, number]);
    doc.rect(0, 30, pageWidth, 2, 'F');
    
    doc.setTextColor(...colors.white as [number, number, number]);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('AI-Powered Executive Summary', 14, 15);
    
    // Get week dates from the component's currentWeekStart (derived from all reports)
    // Falls back to getCurrentWeekDates() only if no reports exist
    const aiPdfWeekStart = currentWeekStart || getCurrentWeekDates().weekStart;
    const aiWeekStartDate = new Date(aiPdfWeekStart + 'T00:00:00Z');
    const aiWeekEndDate = new Date(aiWeekStartDate);
    aiWeekEndDate.setUTCDate(aiWeekStartDate.getUTCDate() + 6);
    const aiWeekEnd = aiWeekEndDate.toISOString().split('T')[0];
    const weekEndFormatted = new Date(aiWeekEnd + 'T00:00:00').toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    doc.setFontSize(10);
    doc.setTextColor(...colors.muted as [number, number, number]);
    doc.text(`Week Ending ${weekEndFormatted}`, 14, 23);
    
    doc.setTextColor(...colors.white as [number, number, number]);
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 14, 15, { align: 'right' });

    let currentY = 40;

    // Helper to render text item
    const renderTextItem = (item: string | { project?: string; achievement?: string; focus?: string; priority?: string }, defaultText: string = '') => {
      if (typeof item === 'string') return item;
      if (item.project && item.achievement) return `${item.project}: ${item.achievement}`;
      if (item.project && item.focus) return `${item.project} (${item.priority || 'medium'}): ${item.focus}`;
      return defaultText;
    };

    // Leadership Summary Section
    if (aiSummary) {
      // Section header
      doc.setFillColor(...colors.navyLight as [number, number, number]);
      doc.roundedRect(14, currentY, pageWidth - 28, 10, 2, 2, 'F');
      doc.setTextColor(...colors.primary as [number, number, number]);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Leadership Insights', 18, currentY + 7);
      
      // Overall health badge
      const healthColors: Record<string, [number, number, number]> = {
        'on-track': colors.success as [number, number, number],
        'needs-attention': colors.warning as [number, number, number],
        'critical': colors.destructive as [number, number, number],
      };
      const healthColor = healthColors[aiSummary.overallHealth] || colors.muted as [number, number, number];
      const healthLabel = aiSummary.overallHealth === 'on-track' ? 'On Track' : 
                         aiSummary.overallHealth === 'needs-attention' ? 'Needs Attention' : 'Critical';
      
      doc.setFillColor(...healthColor);
      doc.roundedRect(pageWidth - 14 - 40, currentY + 2, 38, 6, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.text(healthLabel, pageWidth - 14 - 20, currentY + 6, { align: 'center' });
      
      currentY += 15;
      
      // Executive Summary
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const summaryLines = doc.splitTextToSize(aiSummary.executiveSummary, pageWidth - 28);
      doc.text(summaryLines, 14, currentY);
      currentY += summaryLines.length * 4.5 + 6;

      // Portfolio Health Breakdown (comprehensive format)
      if (aiSummary.portfolioHealthBreakdown) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text('Portfolio Health Breakdown:', 14, currentY);
        currentY += 6;
        
        const phb = aiSummary.portfolioHealthBreakdown;
        const maxWidth = pageWidth - 36;
        
        // On Track
        const onTrackText = `On Track (${phb.onTrack.count}): ${phb.onTrack.projects.slice(0, 5).join(', ')}${phb.onTrack.projects.length > 5 ? '...' : ''}`;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colors.success as [number, number, number]);
        const onTrackLines = doc.splitTextToSize(onTrackText, maxWidth);
        doc.text(onTrackLines, 18, currentY);
        currentY += onTrackLines.length * 3.5 + 1.5;
        
        // Needs Attention
        const needsAttentionText = `Needs Attention (${phb.needsAttention.count}): ${phb.needsAttention.projects.slice(0, 5).join(', ')}${phb.needsAttention.projects.length > 5 ? '...' : ''}`;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colors.warning as [number, number, number]);
        const needsAttentionLines = doc.splitTextToSize(needsAttentionText, maxWidth);
        doc.text(needsAttentionLines, 18, currentY);
        currentY += needsAttentionLines.length * 3.5 + 1.5;
        
        // Critical
        const criticalText = `Critical (${phb.critical.count}): ${phb.critical.projects.slice(0, 5).join(', ')}${phb.critical.projects.length > 5 ? '...' : ''}`;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colors.destructive as [number, number, number]);
        const criticalLines = doc.splitTextToSize(criticalText, maxWidth);
        doc.text(criticalLines, 18, currentY);
        currentY += criticalLines.length * 3.5 + 4;
      }

      // Week-over-Week Changes section
      if (aiSummary.weekOverWeekChanges) {
        const wowc = aiSummary.weekOverWeekChanges;
        const hasChanges = (wowc.improved?.length > 0) || (wowc.worsened?.length > 0) || 
                          (wowc.newRisks?.length > 0) || (wowc.resolved?.length > 0);
        
        if (hasChanges) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(40, 40, 40);
          doc.text('Week-over-Week Changes:', 14, currentY);
          currentY += 6;
          
          const maxWidth = pageWidth - 36;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          
          if (wowc.improved && wowc.improved.length > 0) {
            doc.setTextColor(...colors.success as [number, number, number]);
            doc.text('Improved:', 18, currentY);
            currentY += 3.5;
            doc.setTextColor(80, 80, 80);
            wowc.improved.slice(0, 3).forEach((item: string) => {
              const lines = doc.splitTextToSize(`• ${item}`, maxWidth);
              doc.text(lines, 22, currentY);
              currentY += lines.length * 3.5;
            });
            currentY += 1.5;
          }
          
          if (wowc.worsened && wowc.worsened.length > 0) {
            doc.setTextColor(...colors.destructive as [number, number, number]);
            doc.text('Worsened:', 18, currentY);
            currentY += 3.5;
            doc.setTextColor(80, 80, 80);
            wowc.worsened.slice(0, 3).forEach((item: string) => {
              const lines = doc.splitTextToSize(`• ${item}`, maxWidth);
              doc.text(lines, 22, currentY);
              currentY += lines.length * 3.5;
            });
            currentY += 1.5;
          }
          
          if (wowc.newRisks && wowc.newRisks.length > 0) {
            doc.setTextColor(...colors.warning as [number, number, number]);
            doc.text('New Risks:', 18, currentY);
            currentY += 3.5;
            doc.setTextColor(80, 80, 80);
            wowc.newRisks.slice(0, 3).forEach((item: string) => {
              const lines = doc.splitTextToSize(`• ${item}`, maxWidth);
              doc.text(lines, 22, currentY);
              currentY += lines.length * 3.5;
            });
            currentY += 1.5;
          }
          
          if (wowc.resolved && wowc.resolved.length > 0) {
            doc.setTextColor(...colors.primary as [number, number, number]);
            doc.text('Resolved:', 18, currentY);
            currentY += 3.5;
            doc.setTextColor(80, 80, 80);
            wowc.resolved.slice(0, 3).forEach((item: string) => {
              const lines = doc.splitTextToSize(`• ${item}`, maxWidth);
              doc.text(lines, 22, currentY);
              currentY += lines.length * 3.5;
            });
            currentY += 1.5;
          }
          
          currentY += 3;
        }
      }

      // Immediate Attention Required (comprehensive format)
      if (aiSummary.immediateAttentionRequired && aiSummary.immediateAttentionRequired.length > 0) {
        const attentionItems = aiSummary.immediateAttentionRequired.slice(0, 5);
        const maxWidth = pageWidth - 40;
        
        // Calculate height needed for box
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        let boxHeight = 12;
        attentionItems.forEach((item) => {
          const itemText = `• ${item.project} (${item.lead}): ${item.issue}`;
          const itemLines = doc.splitTextToSize(itemText, maxWidth);
          boxHeight += itemLines.length * 3.5 + 1.5;
        });
        
        doc.setFillColor(255, 240, 240);
        doc.roundedRect(14, currentY, pageWidth - 28, boxHeight, 2, 2, 'F');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.destructive as [number, number, number]);
        doc.text('Immediate Attention Required:', 18, currentY + 6);
        currentY += 11;
        
        attentionItems.forEach((item) => {
          const itemText = `• ${item.project} (${item.lead}): ${item.issue}`;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(80, 80, 80);
          const itemLines = doc.splitTextToSize(itemText, maxWidth);
          doc.text(itemLines, 18, currentY);
          currentY += itemLines.length * 3.5 + 1.5;
        });
        currentY += 4;
      }
      
      // Key sections in a grid
      const sections = [
        { title: 'Key Achievements', items: aiSummary.keyAchievements, color: colors.success },
        { title: 'Week Highlights', items: aiSummary.weekHighlights, color: colors.primary },
        { title: 'Needs Attention', items: aiSummary.attentionNeeded, color: colors.warning },
        { title: 'Upcoming Focus', items: aiSummary.upcomingFocus, color: colors.primary },
        { title: 'Critical Issues', items: aiSummary.criticalIssues, color: colors.destructive },
      ].filter(s => s.items && s.items.length > 0);
      
      sections.forEach(section => {
        doc.setFillColor(...section.color as [number, number, number]);
        doc.circle(16, currentY + 1.5, 1.5, 'F');
        
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(section.title, 20, currentY + 2.5);
        currentY += 6;
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(8);
        (section.items || []).slice(0, 5).forEach((item) => {
          const itemText = renderTextItem(item);
          const lines = doc.splitTextToSize(`• ${itemText}`, pageWidth - 36);
          doc.text(lines, 20, currentY);
          currentY += lines.length * 3.5;
        });
        currentY += 3;
      });

      // Cross-Project Patterns (comprehensive format)
      if (aiSummary.crossProjectPatterns) {
        if (aiSummary.crossProjectPatterns.commonChallenges?.length > 0) {
          doc.setFillColor(...colors.warning as [number, number, number]);
          doc.circle(16, currentY + 1.5, 1.5, 'F');
          doc.setTextColor(40, 40, 40);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.text('Common Challenges', 20, currentY + 2.5);
          currentY += 6;
          
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(80, 80, 80);
          doc.setFontSize(8);
          aiSummary.crossProjectPatterns.commonChallenges.slice(0, 3).forEach((item) => {
            const lines = doc.splitTextToSize(`• ${item}`, pageWidth - 36);
            doc.text(lines, 20, currentY);
            currentY += lines.length * 3.5;
          });
          currentY += 3;
        }
      }

      // Dependencies & Cross-Team Needs
      if (aiSummary.dependenciesAndCrossTeamNeeds && aiSummary.dependenciesAndCrossTeamNeeds.length > 0) {
        doc.setFillColor(...colors.purple as [number, number, number]);
        doc.circle(16, currentY + 1.5, 1.5, 'F');
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Dependencies & Cross-Team Needs', 20, currentY + 2.5);
        currentY += 6;
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(8);
        aiSummary.dependenciesAndCrossTeamNeeds.slice(0, 5).forEach((dep) => {
          const depText = `• ${dep.project}: ${dep.dependency} (Impact: ${dep.impact})`;
          const lines = doc.splitTextToSize(depText, pageWidth - 36);
          doc.text(lines, 20, currentY);
          currentY += lines.length * 3.5;
        });
        currentY += 3;
      }

      // Recommended Leadership Actions (comprehensive format)
      if (aiSummary.recommendedLeadershipActions && aiSummary.recommendedLeadershipActions.length > 0) {
        doc.setFillColor(...colors.primary as [number, number, number]);
        doc.circle(16, currentY + 1.5, 1.5, 'F');
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Recommended Leadership Actions', 20, currentY + 2.5);
        currentY += 6;
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        aiSummary.recommendedLeadershipActions.forEach((item) => {
          const priorityColor = item.priority === 'high' ? colors.destructive : 
                               item.priority === 'medium' ? colors.warning : colors.muted;
          doc.setTextColor(...priorityColor as [number, number, number]);
          doc.text(`[${item.priority.toUpperCase()}]`, 20, currentY);
          doc.setTextColor(80, 80, 80);
          const lines = doc.splitTextToSize(item.action, pageWidth - 55);
          doc.text(lines, 42, currentY);
          currentY += lines.length * 3.5 + 1;
        });
        currentY += 4;
      }
      
      currentY += 6;
    }

    // Footer on last page
    doc.setFillColor(...colors.navy as [number, number, number]);
    doc.rect(0, pageHeight - 10, pageWidth, 10, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...colors.muted as [number, number, number]);
    doc.text('CMS & SS Leadership Summary - AI Generated', 14, pageHeight - 4);
    doc.text(new Date().toLocaleDateString(), pageWidth - 14, pageHeight - 4, { align: 'right' });

    doc.save(`leadership_summary_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Export Team Feedback Summary as standalone PDF
  const exportTeamFeedbackSummaryPDF = () => {
    if (!teamSummary) {
      toast({
        title: 'No Team Feedback Summary Available',
        description: 'Generate an AI summary first before downloading',
        variant: 'destructive',
      });
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait' });
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    const colors = {
      navy: [15, 23, 42],
      navyLight: [30, 41, 59],
      primary: [99, 102, 241],
      success: [34, 197, 94],
      warning: [245, 158, 11],
      destructive: [239, 68, 68],
      white: [255, 255, 255],
      muted: [148, 163, 184],
      border: [51, 65, 85],
      purple: [139, 92, 246],
    };

    // Header
    doc.setFillColor(...colors.navy as [number, number, number]);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 30, pageWidth, 2, 'F');
    
    doc.setTextColor(...colors.white as [number, number, number]);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('SS/CMS Team Feedback Summary', 14, 15);
    
    const tfPdfWeekStart = currentWeekStart || getCurrentWeekDates().weekStart;
    const tfWeekStartDate = new Date(tfPdfWeekStart + 'T00:00:00Z');
    const tfWeekEndDate = new Date(tfWeekStartDate);
    tfWeekEndDate.setUTCDate(tfWeekStartDate.getUTCDate() + 6);
    const tfWeekEnd = tfWeekEndDate.toISOString().split('T')[0];
    const weekEndFormatted = new Date(tfWeekEnd + 'T00:00:00').toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    doc.setFontSize(10);
    doc.setTextColor(...colors.muted as [number, number, number]);
    doc.text(`Week Ending ${weekEndFormatted}`, 14, 23);
    
    doc.setTextColor(...colors.white as [number, number, number]);
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 14, 15, { align: 'right' });

    let currentY = 40;

    // Section header
    doc.setFillColor(...colors.navyLight as [number, number, number]);
    doc.roundedRect(14, currentY, pageWidth - 28, 10, 2, 2, 'F');
    doc.setTextColor(59, 130, 246);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Team Feedback Analysis', 18, currentY + 7);
    
    // Morale badge
    const moraleColors: Record<string, [number, number, number]> = {
      'positive': colors.success as [number, number, number],
      'mixed': colors.warning as [number, number, number],
      'concerning': colors.destructive as [number, number, number]
    };
    const moraleColor = moraleColors[teamSummary.overallTeamMorale] || colors.muted as [number, number, number];
    const moraleLabel = teamSummary.overallTeamMorale === 'positive' ? 'Positive' : 
                        teamSummary.overallTeamMorale === 'mixed' ? 'Mixed' : 'Concerning';
    
    doc.setFillColor(...moraleColor);
    doc.roundedRect(pageWidth - 14 - 40, currentY + 2, 38, 6, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text(`Morale: ${moraleLabel}`, pageWidth - 14 - 20, currentY + 6, { align: 'center' });
    
    currentY += 15;
    
    // Team Summary text
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const teamSummaryLines = doc.splitTextToSize(teamSummary.teamSummary, pageWidth - 28);
    doc.text(teamSummaryLines, 14, currentY);
    currentY += teamSummaryLines.length * 4.5 + 6;
    
    // Helper for team items
    const renderTeamItem = (item: string | { memberName?: string; achievement?: string; highlight?: string; project?: string; concern?: string; area?: string; suggestedSupport?: string; observation?: string; opportunity?: string; indicator?: string }) => {
      if (typeof item === 'string') return item;
      if (item.memberName && item.achievement) return `${item.memberName}: ${item.achievement}`;
      if (item.memberName && item.highlight) return `${item.memberName} (${item.project || ''}): ${item.highlight}`;
      if (item.memberName && item.opportunity) return `${item.memberName}: ${item.opportunity}`;
      if (item.concern) return `${item.concern} (${item.project || ''})`;
      if (item.area && item.suggestedSupport) return `${item.area}: ${item.suggestedSupport}`;
      if (item.observation) return item.observation;
      if (item.indicator) return item.indicator;
      return '';
    };
    
    // Team sections
    const teamSections = [
      { title: 'Recognition Opportunities', items: teamSummary.recognitionOpportunities, color: colors.success },
      { title: 'Team Highlights', items: teamSummary.teamHighlights, color: colors.primary },
      { title: 'Team Concerns', items: teamSummary.teamConcerns, color: colors.warning },
      { title: 'Support Needed', items: teamSummary.supportNeeded, color: colors.destructive },
      { title: 'Workload Observations', items: teamSummary.workloadObservations, color: colors.primary },
      { title: 'Development Opportunities', items: teamSummary.developmentOpportunities, color: colors.purple },
      { title: 'Retention Risks', items: teamSummary.retentionRisks, color: colors.destructive },
    ].filter(s => s.items && s.items.length > 0);
    
    teamSections.forEach(section => {
      // Check for page break
      if (currentY > pageHeight - 30) {
        doc.addPage();
        currentY = 20;
      }
      
      doc.setFillColor(...section.color as [number, number, number]);
      doc.circle(16, currentY + 1.5, 1.5, 'F');
      
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(section.title, 20, currentY + 2.5);
      currentY += 6;
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(8);
      (section.items || []).slice(0, 5).forEach((item) => {
        const itemText = renderTeamItem(item);
        const lines = doc.splitTextToSize(`• ${itemText}`, pageWidth - 36);
        doc.text(lines, 20, currentY);
        currentY += lines.length * 3.5;
      });
      currentY += 3;
    });

    // Recommended HR Actions
    if (teamSummary.recommendedHRActions && teamSummary.recommendedHRActions.length > 0) {
      if (currentY > pageHeight - 30) {
        doc.addPage();
        currentY = 20;
      }
      
      doc.setFillColor(...colors.primary as [number, number, number]);
      doc.circle(16, currentY + 1.5, 1.5, 'F');
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Recommended HR Actions', 20, currentY + 2.5);
      currentY += 6;
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      teamSummary.recommendedHRActions.forEach((item) => {
        const priorityColor = item.priority === 'high' ? colors.destructive : 
                             item.priority === 'medium' ? colors.warning : colors.muted;
        doc.setTextColor(...priorityColor as [number, number, number]);
        doc.text(`[${item.priority.toUpperCase()}]`, 20, currentY);
        doc.setTextColor(80, 80, 80);
        const lines = doc.splitTextToSize(item.action, pageWidth - 55);
        doc.text(lines, 42, currentY);
        currentY += lines.length * 3.5 + 1;
      });
    }

    // Footer on last page
    doc.setFillColor(...colors.navy as [number, number, number]);
    doc.rect(0, pageHeight - 10, pageWidth, 10, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...colors.muted as [number, number, number]);
    doc.text('SS/CMS Team Feedback Summary - AI Generated', 14, pageHeight - 4);
    doc.text(new Date().toLocaleDateString(), pageWidth - 14, pageHeight - 4, { align: 'right' });

    doc.save(`team_feedback_summary_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Generate AI Summary PDF as base64 for archiving (comprehensive - all AI insight components)
  const generateAISummaryPDFBase64 = (weekEndDate: string, leadershipSummary: AISummary | null, teamSummaryParam: TeamSummary | null = null): string => {
    const doc = new jsPDF({ orientation: 'portrait' });
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    const colors = {
      navy: [15, 23, 42],
      navyLight: [30, 41, 59],
      primary: [99, 102, 241],
      success: [34, 197, 94],
      warning: [245, 158, 11],
      destructive: [239, 68, 68],
      white: [255, 255, 255],
      muted: [148, 163, 184],
      border: [51, 65, 85],
      purple: [139, 92, 246],
    };

    // Header
    doc.setFillColor(...colors.navy as [number, number, number]);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setFillColor(...colors.primary as [number, number, number]);
    doc.rect(0, 30, pageWidth, 2, 'F');
    
    doc.setTextColor(...colors.white as [number, number, number]);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('AI-Powered Executive Summary', 14, 15);
    
    const weekEndFormatted = new Date(weekEndDate + 'T00:00:00').toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    doc.setFontSize(10);
    doc.setTextColor(...colors.muted as [number, number, number]);
    doc.text(`Week Ending ${weekEndFormatted}`, 14, 23);
    
    doc.setTextColor(...colors.white as [number, number, number]);
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 14, 15, { align: 'right' });

    let currentY = 40;

    // Helper to render text item
    const renderTextItem = (item: string | { project?: string; achievement?: string; focus?: string; priority?: string }, defaultText: string = '') => {
      if (typeof item === 'string') return item;
      if (item.project && item.achievement) return `${item.project}: ${item.achievement}`;
      if (item.project && item.focus) return `${item.project} (${item.priority || 'medium'}): ${item.focus}`;
      return defaultText;
    };

    // Helper for team items
    const renderTeamItem = (item: string | { memberName?: string; achievement?: string; highlight?: string; project?: string; concern?: string; area?: string; suggestedSupport?: string; observation?: string; opportunity?: string; indicator?: string }) => {
      if (typeof item === 'string') return item;
      if (item.memberName && item.achievement) return `${item.memberName}: ${item.achievement}`;
      if (item.memberName && item.highlight) return `${item.memberName} (${item.project || ''}): ${item.highlight}`;
      if (item.memberName && item.opportunity) return `${item.memberName}: ${item.opportunity}`;
      if (item.concern) return `${item.concern} (${item.project || ''})`;
      if (item.area && item.suggestedSupport) return `${item.area}: ${item.suggestedSupport}`;
      if (item.observation) return item.observation;
      if (item.indicator) return item.indicator;
      return '';
    };

    // Leadership Summary Section
    if (leadershipSummary) {
      // Section header
      doc.setFillColor(...colors.navyLight as [number, number, number]);
      doc.roundedRect(14, currentY, pageWidth - 28, 10, 2, 2, 'F');
      doc.setTextColor(...colors.primary as [number, number, number]);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Leadership Insights', 18, currentY + 7);
      
      // Overall health badge
      const healthColors: Record<string, [number, number, number]> = {
        'on-track': colors.success as [number, number, number],
        'needs-attention': colors.warning as [number, number, number],
        'critical': colors.destructive as [number, number, number],
      };
      const healthColor = healthColors[leadershipSummary.overallHealth] || colors.muted as [number, number, number];
      const healthLabel = leadershipSummary.overallHealth === 'on-track' ? 'On Track' : 
                         leadershipSummary.overallHealth === 'needs-attention' ? 'Needs Attention' : 'Critical';
      
      doc.setFillColor(...healthColor);
      doc.roundedRect(pageWidth - 14 - 40, currentY + 2, 38, 6, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.text(healthLabel, pageWidth - 14 - 20, currentY + 6, { align: 'center' });
      
      currentY += 15;
      
      // Executive Summary
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const summaryLines = doc.splitTextToSize(leadershipSummary.executiveSummary, pageWidth - 28);
      doc.text(summaryLines, 14, currentY);
      currentY += summaryLines.length * 4.5 + 6;

      // Portfolio Health Breakdown (comprehensive format with project names)
      if (leadershipSummary.portfolioHealthBreakdown) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text('Portfolio Health Breakdown:', 14, currentY);
        currentY += 6;
        
        const phb = leadershipSummary.portfolioHealthBreakdown;
        const maxWidth = pageWidth - 36;
        
        // On Track with project names
        const onTrackText = `On Track (${phb.onTrack.count}): ${phb.onTrack.projects.slice(0, 5).join(', ')}${phb.onTrack.projects.length > 5 ? '...' : ''}`;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colors.success as [number, number, number]);
        const onTrackLines = doc.splitTextToSize(onTrackText, maxWidth);
        doc.text(onTrackLines, 18, currentY);
        currentY += onTrackLines.length * 3.5 + 1.5;
        
        // Needs Attention with project names
        const needsAttentionText = `Needs Attention (${phb.needsAttention.count}): ${phb.needsAttention.projects.slice(0, 5).join(', ')}${phb.needsAttention.projects.length > 5 ? '...' : ''}`;
        doc.setTextColor(...colors.warning as [number, number, number]);
        const needsAttentionLines = doc.splitTextToSize(needsAttentionText, maxWidth);
        doc.text(needsAttentionLines, 18, currentY);
        currentY += needsAttentionLines.length * 3.5 + 1.5;
        
        // Critical with project names
        const criticalText = `Critical (${phb.critical.count}): ${phb.critical.projects.slice(0, 5).join(', ')}${phb.critical.projects.length > 5 ? '...' : ''}`;
        doc.setTextColor(...colors.destructive as [number, number, number]);
        const criticalLines = doc.splitTextToSize(criticalText, maxWidth);
        doc.text(criticalLines, 18, currentY);
        currentY += criticalLines.length * 3.5 + 4;
      }

      // Week-over-Week Changes section
      if (leadershipSummary.weekOverWeekChanges) {
        const wowc = leadershipSummary.weekOverWeekChanges;
        const hasChanges = (wowc.improved?.length > 0) || (wowc.worsened?.length > 0) || 
                          (wowc.newRisks?.length > 0) || (wowc.resolved?.length > 0);
        
        if (hasChanges) {
          if (currentY > pageHeight - 40) {
            doc.addPage();
            currentY = 20;
          }
          
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(40, 40, 40);
          doc.text('Week-over-Week Changes:', 14, currentY);
          currentY += 6;
          
          const maxWidth = pageWidth - 36;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          
          if (wowc.improved && wowc.improved.length > 0) {
            doc.setTextColor(...colors.success as [number, number, number]);
            doc.text('Improved:', 18, currentY);
            currentY += 3.5;
            doc.setTextColor(80, 80, 80);
            wowc.improved.slice(0, 3).forEach((item: string) => {
              const lines = doc.splitTextToSize(`• ${item}`, maxWidth);
              doc.text(lines, 22, currentY);
              currentY += lines.length * 3.5;
            });
            currentY += 1.5;
          }
          
          if (wowc.worsened && wowc.worsened.length > 0) {
            doc.setTextColor(...colors.destructive as [number, number, number]);
            doc.text('Worsened:', 18, currentY);
            currentY += 3.5;
            doc.setTextColor(80, 80, 80);
            wowc.worsened.slice(0, 3).forEach((item: string) => {
              const lines = doc.splitTextToSize(`• ${item}`, maxWidth);
              doc.text(lines, 22, currentY);
              currentY += lines.length * 3.5;
            });
            currentY += 1.5;
          }
          
          if (wowc.newRisks && wowc.newRisks.length > 0) {
            doc.setTextColor(...colors.warning as [number, number, number]);
            doc.text('New Risks:', 18, currentY);
            currentY += 3.5;
            doc.setTextColor(80, 80, 80);
            wowc.newRisks.slice(0, 3).forEach((item: string) => {
              const lines = doc.splitTextToSize(`• ${item}`, maxWidth);
              doc.text(lines, 22, currentY);
              currentY += lines.length * 3.5;
            });
            currentY += 1.5;
          }
          
          if (wowc.resolved && wowc.resolved.length > 0) {
            doc.setTextColor(...colors.primary as [number, number, number]);
            doc.text('Resolved:', 18, currentY);
            currentY += 3.5;
            doc.setTextColor(80, 80, 80);
            wowc.resolved.slice(0, 3).forEach((item: string) => {
              const lines = doc.splitTextToSize(`• ${item}`, maxWidth);
              doc.text(lines, 22, currentY);
              currentY += lines.length * 3.5;
            });
            currentY += 1.5;
          }
          
          currentY += 3;
        }
      }

      // Immediate Attention Required (comprehensive format)
      if (leadershipSummary.immediateAttentionRequired && leadershipSummary.immediateAttentionRequired.length > 0) {
        if (currentY > pageHeight - 50) {
          doc.addPage();
          currentY = 20;
        }
        
        const attentionItems = leadershipSummary.immediateAttentionRequired.slice(0, 5);
        const maxWidth = pageWidth - 40;
        
        // Calculate height needed for box
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        let boxHeight = 12;
        attentionItems.forEach((item) => {
          const itemText = `• ${item.project} (${item.lead}): ${item.issue}`;
          const itemLines = doc.splitTextToSize(itemText, maxWidth);
          boxHeight += itemLines.length * 3.5 + 1.5;
        });
        
        doc.setFillColor(255, 240, 240);
        doc.roundedRect(14, currentY, pageWidth - 28, boxHeight, 2, 2, 'F');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.destructive as [number, number, number]);
        doc.text('Immediate Attention Required:', 18, currentY + 6);
        currentY += 11;
        
        attentionItems.forEach((item) => {
          const itemText = `• ${item.project} (${item.lead}): ${item.issue}`;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(80, 80, 80);
          const itemLines = doc.splitTextToSize(itemText, maxWidth);
          doc.text(itemLines, 18, currentY);
          currentY += itemLines.length * 3.5 + 1.5;
        });
        currentY += 4;
      }
      
      // Key sections
      const sections = [
        { title: 'Key Achievements', items: leadershipSummary.keyAchievements, color: colors.success },
        { title: 'Week Highlights', items: leadershipSummary.weekHighlights, color: colors.primary },
        { title: 'Needs Attention', items: leadershipSummary.attentionNeeded, color: colors.warning },
        { title: 'Upcoming Focus', items: leadershipSummary.upcomingFocus, color: colors.primary },
        { title: 'Critical Issues', items: leadershipSummary.criticalIssues, color: colors.destructive },
      ].filter(s => s.items && s.items.length > 0);
      
      sections.forEach(section => {
        if (currentY > pageHeight - 30) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.setFillColor(...section.color as [number, number, number]);
        doc.circle(16, currentY + 1.5, 1.5, 'F');
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(section.title, 20, currentY + 2.5);
        currentY += 6;
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(8);
        (section.items || []).slice(0, 5).forEach((item) => {
          const itemText = renderTextItem(item);
          const lines = doc.splitTextToSize(`• ${itemText}`, pageWidth - 36);
          doc.text(lines, 20, currentY);
          currentY += lines.length * 3.5;
        });
        currentY += 3;
      });

      // Cross-Project Patterns (comprehensive format)
      if (leadershipSummary.crossProjectPatterns) {
        const cpp = leadershipSummary.crossProjectPatterns;
        
        // Common Challenges
        if (cpp.commonChallenges?.length > 0) {
          if (currentY > pageHeight - 30) {
            doc.addPage();
            currentY = 20;
          }
          
          doc.setFillColor(...colors.warning as [number, number, number]);
          doc.circle(16, currentY + 1.5, 1.5, 'F');
          doc.setTextColor(40, 40, 40);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.text('Common Challenges', 20, currentY + 2.5);
          currentY += 6;
          
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(80, 80, 80);
          doc.setFontSize(8);
          cpp.commonChallenges.slice(0, 5).forEach((item) => {
            const lines = doc.splitTextToSize(`• ${item}`, pageWidth - 36);
            doc.text(lines, 20, currentY);
            currentY += lines.length * 3.5;
          });
          currentY += 3;
        }
        
        // Emerging Risks
        if (cpp.emergingRisks && cpp.emergingRisks.length > 0) {
          if (currentY > pageHeight - 30) {
            doc.addPage();
            currentY = 20;
          }
          
          doc.setFillColor(...colors.destructive as [number, number, number]);
          doc.circle(16, currentY + 1.5, 1.5, 'F');
          doc.setTextColor(40, 40, 40);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.text('Emerging Risks', 20, currentY + 2.5);
          currentY += 6;
          
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(80, 80, 80);
          doc.setFontSize(8);
          cpp.emergingRisks.slice(0, 5).forEach((item: string) => {
            const lines = doc.splitTextToSize(`• ${item}`, pageWidth - 36);
            doc.text(lines, 20, currentY);
            currentY += lines.length * 3.5;
          });
          currentY += 3;
        }
        
        // Positive Indicators
        if (cpp.positiveIndicators && cpp.positiveIndicators.length > 0) {
          if (currentY > pageHeight - 30) {
            doc.addPage();
            currentY = 20;
          }
          
          doc.setFillColor(...colors.success as [number, number, number]);
          doc.circle(16, currentY + 1.5, 1.5, 'F');
          doc.setTextColor(40, 40, 40);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.text('Positive Indicators', 20, currentY + 2.5);
          currentY += 6;
          
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(80, 80, 80);
          doc.setFontSize(8);
          cpp.positiveIndicators.slice(0, 5).forEach((item: string) => {
            const lines = doc.splitTextToSize(`• ${item}`, pageWidth - 36);
            doc.text(lines, 20, currentY);
            currentY += lines.length * 3.5;
          });
          currentY += 3;
        }
      }

      // Dependencies & Cross-Team Needs
      if (leadershipSummary.dependenciesAndCrossTeamNeeds && leadershipSummary.dependenciesAndCrossTeamNeeds.length > 0) {
        if (currentY > pageHeight - 30) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.setFillColor(...colors.purple as [number, number, number]);
        doc.circle(16, currentY + 1.5, 1.5, 'F');
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Dependencies & Cross-Team Needs', 20, currentY + 2.5);
        currentY += 6;
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(8);
        leadershipSummary.dependenciesAndCrossTeamNeeds.slice(0, 5).forEach((dep) => {
          const depText = `• ${dep.project}: ${dep.dependency} (Impact: ${dep.impact})`;
          const lines = doc.splitTextToSize(depText, pageWidth - 36);
          doc.text(lines, 20, currentY);
          currentY += lines.length * 3.5;
        });
        currentY += 3;
      }

      // Recommended Leadership Actions (comprehensive format)
      if (leadershipSummary.recommendedLeadershipActions && leadershipSummary.recommendedLeadershipActions.length > 0) {
        if (currentY > pageHeight - 30) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.setFillColor(...colors.primary as [number, number, number]);
        doc.circle(16, currentY + 1.5, 1.5, 'F');
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Recommended Leadership Actions', 20, currentY + 2.5);
        currentY += 6;
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        leadershipSummary.recommendedLeadershipActions.forEach((item) => {
          if (currentY > pageHeight - 20) {
            doc.addPage();
            currentY = 20;
          }
          const priorityColor = item.priority === 'high' ? colors.destructive : 
                               item.priority === 'medium' ? colors.warning : colors.muted;
          doc.setTextColor(...priorityColor as [number, number, number]);
          doc.text(`[${item.priority.toUpperCase()}]`, 20, currentY);
          doc.setTextColor(80, 80, 80);
          const lines = doc.splitTextToSize(item.action, pageWidth - 55);
          doc.text(lines, 42, currentY);
          currentY += lines.length * 3.5 + 1;
        });
        currentY += 4;
      }
      
      currentY += 6;
    }

    // Team Summary Section
    if (teamSummaryParam) {
      // Check if we need a new page
      if (currentY > pageHeight - 80) {
        doc.addPage();
        currentY = 20;
      }
      
      // Section header
      doc.setFillColor(...colors.navyLight as [number, number, number]);
      doc.roundedRect(14, currentY, pageWidth - 28, 10, 2, 2, 'F');
      doc.setTextColor(59, 130, 246);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('SS/CMS Team Feedback Summary', 18, currentY + 7);
      
      // Morale badge
      const moraleColors: Record<string, [number, number, number]> = {
        'positive': colors.success as [number, number, number],
        'mixed': colors.warning as [number, number, number],
        'concerning': colors.destructive as [number, number, number]
      };
      const moraleColor = moraleColors[teamSummaryParam.overallTeamMorale] || colors.muted as [number, number, number];
      const moraleLabel = teamSummaryParam.overallTeamMorale === 'positive' ? 'Positive' : 
                          teamSummaryParam.overallTeamMorale === 'mixed' ? 'Mixed' : 'Concerning';
      
      doc.setFillColor(...moraleColor);
      doc.roundedRect(pageWidth - 14 - 40, currentY + 2, 38, 6, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.text(`Morale: ${moraleLabel}`, pageWidth - 14 - 20, currentY + 6, { align: 'center' });
      
      currentY += 15;
      
      // SS/CMS Team Feedback Summary text
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const teamSummaryLines = doc.splitTextToSize(teamSummaryParam.teamSummary, pageWidth - 28);
      doc.text(teamSummaryLines, 14, currentY);
      currentY += teamSummaryLines.length * 4.5 + 6;
      
      // Team sections (comprehensive)
      const teamSections = [
        { title: 'Recognition Opportunities', items: teamSummaryParam.recognitionOpportunities, color: colors.success },
        { title: 'Team Highlights', items: teamSummaryParam.teamHighlights, color: colors.primary },
        { title: 'Team Concerns', items: teamSummaryParam.teamConcerns, color: colors.warning },
        { title: 'Support Needed', items: teamSummaryParam.supportNeeded, color: colors.destructive },
        { title: 'Workload Observations', items: teamSummaryParam.workloadObservations, color: colors.primary },
        { title: 'Development Opportunities', items: teamSummaryParam.developmentOpportunities, color: colors.purple },
        { title: 'Retention Risks', items: teamSummaryParam.retentionRisks, color: colors.destructive },
      ].filter(s => s.items && s.items.length > 0);
      
      teamSections.forEach(section => {
        // Check for page break
        if (currentY > pageHeight - 30) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.setFillColor(...section.color as [number, number, number]);
        doc.circle(16, currentY + 1.5, 1.5, 'F');
        
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(section.title, 20, currentY + 2.5);
        currentY += 6;
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(8);
        (section.items || []).slice(0, 5).forEach((item) => {
          const itemText = renderTeamItem(item);
          const lines = doc.splitTextToSize(`• ${itemText}`, pageWidth - 36);
          doc.text(lines, 20, currentY);
          currentY += lines.length * 3.5;
        });
        currentY += 3;
      });

      // Recommended HR Actions (comprehensive format)
      if (teamSummaryParam.recommendedHRActions && teamSummaryParam.recommendedHRActions.length > 0) {
        if (currentY > pageHeight - 30) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.setFillColor(...colors.primary as [number, number, number]);
        doc.circle(16, currentY + 1.5, 1.5, 'F');
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Recommended HR Actions', 20, currentY + 2.5);
        currentY += 6;
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        teamSummaryParam.recommendedHRActions.forEach((item) => {
          if (currentY > pageHeight - 20) {
            doc.addPage();
            currentY = 20;
          }
          const priorityColor = item.priority === 'high' ? colors.destructive : 
                               item.priority === 'medium' ? colors.warning : colors.muted;
          doc.setTextColor(...priorityColor as [number, number, number]);
          doc.text(`[${item.priority.toUpperCase()}]`, 20, currentY);
          doc.setTextColor(80, 80, 80);
          const lines = doc.splitTextToSize(item.action, pageWidth - 55);
          doc.text(lines, 42, currentY);
          currentY += lines.length * 3.5 + 1;
        });
      }
    }

    // Footer on last page
    doc.setFillColor(...colors.navy as [number, number, number]);
    doc.rect(0, pageHeight - 10, pageWidth, 10, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...colors.muted as [number, number, number]);
    doc.text('CMS & SS Executive Summary - AI Generated', 14, pageHeight - 4);
    doc.text(new Date().toLocaleDateString(), pageWidth - 14, pageHeight - 4, { align: 'right' });

    return doc.output('datauristring').split(',')[1];
  };

  // Track if Force Archive is in progress
  const [isForceArchiving, setIsForceArchiving] = useState(false);
  const [showAllFeedback, setShowAllFeedback] = useState(false);
  const [showAllReports, setShowAllReports] = useState(false);
  // Track which lead sections are expanded (show more than 2 reports)
  const [expandedLeadSections, setExpandedLeadSections] = useState<Set<string>>(new Set());

  // Save current reports to archive (generates AI summaries, PDF, CSV, archives, then resets)
  // Now saves 2 separate reports: one for Account Reports (leadership summary + account CSV)
  // and one for Team Reports (team feedback summary + team feedback CSV)
  const saveToArchive = async () => {
    if (sortedReports.length === 0) {
      toast({
        title: 'No Reports to Archive',
        description: 'Submit some reports first before archiving',
        variant: 'destructive',
      });
      return;
    }

    setIsForceArchiving(true);

    try {
      // Step 1: Get week dates from the actual reports (not calculated from today)
      const reportWeekStart = weeklyReports[0].weekStart;
      const weekStartDate = new Date(reportWeekStart + 'T00:00:00Z');
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6);
      const weekEnd = weekEndDate.toISOString().split('T')[0];

      // Step 2: Generate both AI summaries (leadership + team) if they don't exist
      let leadershipSummaryToArchive = aiSummary;
      let teamSummaryToArchive = teamSummary;
      if (!leadershipSummaryToArchive) {
        toast({
          title: 'Generating AI Summaries',
          description: 'Please wait while we analyze the reports...',
        });
        try {
          const summaryResponse = await apiRequest('POST', '/api/weekly-reports/ai-summary');
          const summaryData = await summaryResponse.json();
          if (summaryData.summary) {
            leadershipSummaryToArchive = summaryData.summary;
            teamSummaryToArchive = summaryData.teamSummary || null;
            setAiSummary(summaryData.summary);
            setTeamSummary(summaryData.teamSummary || null);
            setSummaryGeneratedAt(summaryData.generatedAt);
            setReportsAnalyzed(summaryData.reportsAnalyzed || 0);
          }
        } catch (summaryError) {
          console.error('Failed to generate AI summaries:', summaryError);
          // Continue without AI summaries if it fails
        }
      }

      const submittedReports = weeklyReports.filter(r => r.status === 'submitted');

      // Step 3: Calculate health counts
      const healthCounts = {
        onTrack: submittedReports.filter(r => r.healthStatus === 'on-track').length,
        needsAttention: submittedReports.filter(r => r.healthStatus === 'at-risk').length,
        critical: submittedReports.filter(r => r.healthStatus === 'critical').length,
      };

      // Step 4: Generate separate data for Account Reports and Team Reports
      // Account Report: Leadership summary PDF + Account reports CSV
      const accountPdfBase64 = leadershipSummaryToArchive 
        ? generateAISummaryPDFBase64(weekEnd, leadershipSummaryToArchive, null) // Leadership only
        : '';
      const accountCsvContent = generateAccountReportsCSV();

      // Team Report: Team feedback summary PDF + Team feedback CSV
      const teamPdfBase64 = teamSummaryToArchive 
        ? generateAISummaryPDFBase64(weekEnd, null, teamSummaryToArchive) // Team only
        : '';
      const teamCsvContent = generateTeamFeedbackCSV();

      // Step 5: Archive via API - Save 2 separate reports
      console.log(`[Archive] Archiving ${submittedReports.length} reports for week ${reportWeekStart} to ${weekEnd}`);
      console.log(`[Archive] Account PDF size: ${(accountPdfBase64.length / 1024 / 1024).toFixed(2)} MB`);
      console.log(`[Archive] Account CSV size: ${(accountCsvContent.length / 1024).toFixed(2)} KB`);
      console.log(`[Archive] Team PDF size: ${(teamPdfBase64.length / 1024 / 1024).toFixed(2)} MB`);
      console.log(`[Archive] Team CSV size: ${(teamCsvContent.length / 1024).toFixed(2)} KB`);
      
      // Save Account Report (type: 'account')
      const accountArchiveResponse = await apiRequest('POST', '/api/saved-reports', {
        weekStart: reportWeekStart,
        weekEnd: weekEnd,
        reportType: 'account',
        reportCount: String(submittedReports.length),
        healthCounts,
        aiSummary: leadershipSummaryToArchive,
        pdfData: accountPdfBase64,
        csvData: accountCsvContent,
      });
      
      if (!accountArchiveResponse.ok) {
        const errorData = await accountArchiveResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Account archive save failed with status ${accountArchiveResponse.status}`);
      }

      // Save Team Report (type: 'team')
      const teamArchiveResponse = await apiRequest('POST', '/api/saved-reports', {
        weekStart: reportWeekStart,
        weekEnd: weekEnd,
        reportType: 'team',
        reportCount: String(peopleWithFeedback.length),
        healthCounts: null,
        aiSummary: teamSummaryToArchive,
        pdfData: teamPdfBase64,
        csvData: teamCsvContent,
      });
      
      if (!teamArchiveResponse.ok) {
        const errorData = await teamArchiveResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Team archive save failed with status ${teamArchiveResponse.status}`);
      }

      // Step 6: Reset - Delete all current reports, AI summary, and team feedback
      await apiRequest('DELETE', '/api/weekly-reports', {});
      if (currentWeekStart) {
        await apiRequest('DELETE', `/api/current-ai-summary/${currentWeekStart}`, {});
      }
      // Clear all team feedback after archiving
      await apiRequest('DELETE', '/api/people/feedback', {});

      // Step 7: Invalidate queries and clear local state
      queryClient.invalidateQueries({ queryKey: ['/api/weekly-reports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/saved-reports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/current-ai-summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reporting-week'] }); // Advance to next week
      queryClient.invalidateQueries({ queryKey: ['/api/people/feedback'] }); // Clear feedback UI
      
      setAiSummary(null);
      setTeamSummary(null);
      setSummaryGeneratedAt(null);
      setReportsAnalyzed(0);

      const summaryNote = leadershipSummaryToArchive ? (teamSummaryToArchive ? ' with AI summaries' : ' with leadership summary') : '';
      toast({
        title: 'Archive Complete',
        description: `Week ending ${weekEnd} has been archived${summaryNote} as 2 separate reports (Account + Team).`,
      });
    } catch (error: any) {
      console.error('Force archive failed:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      toast({
        title: 'Archive Failed',
        description: `Failed to archive reports: ${errorMessage}`,
        variant: 'destructive',
      });
    } finally {
      setIsForceArchiving(false);
    }
  };

  const getOverallHealthConfig = (health: string) => {
    if (health === 'on-track') return { label: 'On Track', color: 'text-success', bgColor: 'bg-success/10', borderColor: 'border-success/30' };
    if (health === 'needs-attention') return { label: 'Needs Attention', color: 'text-warning', bgColor: 'bg-warning/10', borderColor: 'border-warning/30' };
    return { label: 'Critical', color: 'text-destructive', bgColor: 'bg-destructive/10', borderColor: 'border-destructive/30' };
  };

  return (
    <div className="space-y-8">
      {/* Leadership Summary Modal */}
      <Dialog open={showLeadershipModal} onOpenChange={setShowLeadershipModal}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="section-label">AI-Powered Insights</p>
                <DialogTitle className="text-2xl">Leadership Summary</DialogTitle>
              </div>
            </div>
          </DialogHeader>
          {aiSummary && (
            <div className="space-y-6 mt-4">
              {/* Executive Summary */}
              <div className={`p-4 rounded-lg ${getOverallHealthConfig(aiSummary.overallHealth).bgColor} border ${getOverallHealthConfig(aiSummary.overallHealth).borderColor}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={`${getOverallHealthConfig(aiSummary.overallHealth).bgColor} ${getOverallHealthConfig(aiSummary.overallHealth).color} border-0`}>
                    {aiSummary.overallHealth === 'on-track' && <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                    {aiSummary.overallHealth === 'needs-attention' && <AlertTriangle className="h-3.5 w-3.5 mr-1" />}
                    {aiSummary.overallHealth === 'critical' && <AlertCircle className="h-3.5 w-3.5 mr-1" />}
                    Overall: {getOverallHealthConfig(aiSummary.overallHealth).label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Based on {reportsAnalyzed} report{reportsAnalyzed !== 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-foreground leading-relaxed">{aiSummary.executiveSummary}</p>
              </div>

              {/* Week-over-Week Changes */}
              {aiSummary.weekOverWeekChanges && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold">Week-over-Week Changes</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {aiSummary.weekOverWeekChanges.improved?.length > 0 && (
                      <div className="p-3 rounded-lg bg-success/5 border border-success/20">
                        <h5 className="text-sm font-medium text-success mb-2 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Improved
                        </h5>
                        <ul className="space-y-1">
                          {aiSummary.weekOverWeekChanges.improved.map((item, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-success mt-1.5 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {aiSummary.weekOverWeekChanges.worsened?.length > 0 && (
                      <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                        <h5 className="text-sm font-medium text-destructive mb-2 flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Worsened
                        </h5>
                        <ul className="space-y-1">
                          {aiSummary.weekOverWeekChanges.worsened.map((item, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {aiSummary.weekOverWeekChanges.newRisks?.length > 0 && (
                      <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
                        <h5 className="text-sm font-medium text-warning mb-2 flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          New Risks
                        </h5>
                        <ul className="space-y-1">
                          {aiSummary.weekOverWeekChanges.newRisks.map((item, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-warning mt-1.5 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {aiSummary.weekOverWeekChanges.resolved?.length > 0 && (
                      <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                        <h5 className="text-sm font-medium text-blue-500 mb-2 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Resolved
                        </h5>
                        <ul className="space-y-1">
                          {aiSummary.weekOverWeekChanges.resolved.map((item, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Portfolio Health Breakdown */}
              {aiSummary.portfolioHealthBreakdown && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-success/10 border border-success/30">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <h4 className="font-medium text-success">On Track ({aiSummary.portfolioHealthBreakdown.onTrack.count})</h4>
                    </div>
                    <ul className="space-y-1 max-h-32 overflow-y-auto">
                      {aiSummary.portfolioHealthBreakdown.onTrack.projects.map((project, i) => (
                        <li key={i} className="text-xs text-muted-foreground">{project}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      <h4 className="font-medium text-warning">Needs Attention ({aiSummary.portfolioHealthBreakdown.needsAttention.count})</h4>
                    </div>
                    <ul className="space-y-1 max-h-32 overflow-y-auto">
                      {aiSummary.portfolioHealthBreakdown.needsAttention.projects.map((project, i) => (
                        <li key={i} className="text-xs text-muted-foreground">{project}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <h4 className="font-medium text-destructive">Critical ({aiSummary.portfolioHealthBreakdown.critical.count})</h4>
                    </div>
                    <ul className="space-y-1 max-h-32 overflow-y-auto">
                      {aiSummary.portfolioHealthBreakdown.critical.projects.map((project, i) => (
                        <li key={i} className="text-xs text-muted-foreground">{project}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Immediate Attention Required */}
              {aiSummary.immediateAttentionRequired && aiSummary.immediateAttentionRequired.length > 0 && (
                <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <h4 className="font-semibold text-destructive">Immediate Attention Required</h4>
                  </div>
                  <div className="space-y-3">
                    {aiSummary.immediateAttentionRequired.map((item, i) => (
                      <div key={i} className="p-3 rounded-lg bg-background/50 border border-white/10">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{item.project}</span>
                          <Badge variant="outline" className="text-xs">{item.customer}</Badge>
                          <span className="text-xs text-muted-foreground">Lead: {item.lead}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{item.issue}</p>
                        <div className="flex items-start gap-2 text-sm">
                          <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <span className="text-primary">{item.recommendedAction}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Achievements */}
              {aiSummary.keyAchievements && aiSummary.keyAchievements.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <h4 className="font-semibold">Key Achievements</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {aiSummary.keyAchievements.map((item, i) => (
                      <div key={i} className="p-3 rounded-lg bg-success/5 border border-success/20">
                        {typeof item === 'string' ? (
                          <p className="text-sm text-muted-foreground">{item}</p>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{item.project}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{item.achievement}</p>
                            {item.impact && (
                              <p className="text-xs text-success mt-1">{item.impact}</p>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cross-Project Patterns */}
              {aiSummary.crossProjectPatterns && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold">Cross-Project Patterns</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {aiSummary.crossProjectPatterns.commonChallenges?.length > 0 && (
                      <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
                        <h5 className="text-sm font-medium text-warning mb-2">Common Challenges</h5>
                        <ul className="space-y-1">
                          {aiSummary.crossProjectPatterns.commonChallenges.map((item, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-warning mt-1.5 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {aiSummary.crossProjectPatterns.resourceConstraints?.length > 0 && (
                      <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                        <h5 className="text-sm font-medium text-blue-500 mb-2">Resource Constraints</h5>
                        <ul className="space-y-1">
                          {aiSummary.crossProjectPatterns.resourceConstraints.map((item, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {aiSummary.crossProjectPatterns.processIssues?.length > 0 && (
                      <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                        <h5 className="text-sm font-medium text-purple-500 mb-2">Process Issues</h5>
                        <ul className="space-y-1">
                          {aiSummary.crossProjectPatterns.processIssues.map((item, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Dependencies and Cross-Team Needs */}
              {aiSummary.dependenciesAndCrossTeamNeeds && aiSummary.dependenciesAndCrossTeamNeeds.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold">Dependencies & Cross-Team Needs</h4>
                  </div>
                  <div className="space-y-3">
                    {aiSummary.dependenciesAndCrossTeamNeeds.map((item, i) => (
                      <div key={i} className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{item.project}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          <span className="font-medium">Dependency:</span> {item.dependency}
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <span className="font-medium">Impact:</span> {item.impact}
                        </p>
                        <div className="flex items-start gap-2 text-sm">
                          <Target className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                          <span className="text-blue-500">{item.requiredSupport}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Focus */}
              {aiSummary.upcomingFocus && aiSummary.upcomingFocus.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold">Upcoming Focus</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {aiSummary.upcomingFocus.map((item, i) => (
                      <div key={i} className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        {typeof item === 'string' ? (
                          <p className="text-sm text-muted-foreground">{item}</p>
                        ) : (
                          <>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-medium text-sm">{item.project}</span>
                              <Badge variant={item.priority === 'high' ? 'destructive' : item.priority === 'medium' ? 'default' : 'secondary'} className="text-xs">
                                {item.priority}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{item.focus}</p>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Leadership Actions */}
              {aiSummary.recommendedLeadershipActions && aiSummary.recommendedLeadershipActions.length > 0 && (
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold">Recommended Leadership Actions</h4>
                  </div>
                  <div className="space-y-3">
                    {aiSummary.recommendedLeadershipActions.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-white/10">
                        <Badge variant={item.priority === 'high' ? 'destructive' : 'default'} className="shrink-0 mt-0.5">
                          {item.priority}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium">{item.action}</p>
                          <p className="text-xs text-muted-foreground mt-1">{item.rationale}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Legacy fields for backward compatibility */}
              {!aiSummary.portfolioHealthBreakdown && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {aiSummary.weekHighlights && aiSummary.weekHighlights.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <h4 className="font-medium">Week Highlights</h4>
                      </div>
                      <ul className="space-y-1.5">
                        {aiSummary.weekHighlights.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiSummary.criticalIssues && aiSummary.criticalIssues.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        <h4 className="font-medium">Critical Issues</h4>
                      </div>
                      <ul className="space-y-1.5">
                        {aiSummary.criticalIssues.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <div className="h-1.5 w-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiSummary.attentionNeeded && aiSummary.attentionNeeded.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        <h4 className="font-medium">Needs Attention</h4>
                      </div>
                      <ul className="space-y-1.5">
                        {aiSummary.attentionNeeded.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <div className="h-1.5 w-1.5 rounded-full bg-warning mt-1.5 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Week Highlights (new format) */}
              {aiSummary.portfolioHealthBreakdown && aiSummary.weekHighlights && aiSummary.weekHighlights.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <h4 className="font-medium">Week Highlights</h4>
                  </div>
                  <ul className="space-y-1.5">
                    {aiSummary.weekHighlights.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* SS/CMS Team Feedback Summary Modal */}
      <Dialog open={showTeamModal} onOpenChange={setShowTeamModal}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="section-label">AI-Powered Team Insights</p>
                <DialogTitle className="text-2xl">SS/CMS Team Feedback Summary</DialogTitle>
              </div>
            </div>
          </DialogHeader>
          {teamSummary && (
            <div className="space-y-6 mt-4">
              {/* Team Morale Overview */}
              <div className={`p-4 rounded-lg ${
                teamSummary.overallTeamMorale === 'positive' ? 'bg-success/10 border border-success/30' :
                teamSummary.overallTeamMorale === 'mixed' ? 'bg-warning/10 border border-warning/30' :
                'bg-destructive/10 border border-destructive/30'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={`${
                    teamSummary.overallTeamMorale === 'positive' ? 'bg-success/10 text-success' :
                    teamSummary.overallTeamMorale === 'mixed' ? 'bg-warning/10 text-warning' :
                    'bg-destructive/10 text-destructive'
                  } border-0`}>
                    {teamSummary.overallTeamMorale === 'positive' && <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                    {teamSummary.overallTeamMorale === 'mixed' && <AlertTriangle className="h-3.5 w-3.5 mr-1" />}
                    {teamSummary.overallTeamMorale === 'concerning' && <AlertCircle className="h-3.5 w-3.5 mr-1" />}
                    Team Morale: {teamSummary.overallTeamMorale === 'positive' ? 'Positive' : 
                                  teamSummary.overallTeamMorale === 'mixed' ? 'Mixed' : 'Concerning'}
                  </Badge>
                </div>
                <p className="text-foreground leading-relaxed">{teamSummary.teamSummary}</p>
              </div>

              {/* Team Highlights */}
              {teamSummary.teamHighlights && teamSummary.teamHighlights.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                    <h4 className="font-semibold">Team Highlights</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {teamSummary.teamHighlights.map((item, i) => (
                      <div key={i} className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                        {typeof item === 'string' ? (
                          <p className="text-sm text-muted-foreground">{item}</p>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{item.memberName}</span>
                              <Badge variant="outline" className="text-xs">{item.project}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{item.highlight}</p>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recognition Opportunities */}
              {teamSummary.recognitionOpportunities && teamSummary.recognitionOpportunities.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-success" />
                    <h4 className="font-semibold">Recognition Opportunities</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {teamSummary.recognitionOpportunities.map((item, i) => (
                      <div key={i} className="p-3 rounded-lg bg-success/5 border border-success/20">
                        {typeof item === 'string' ? (
                          <p className="text-sm text-muted-foreground">{item}</p>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{item.memberName}</span>
                              <Badge variant="outline" className="text-xs">{item.project}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{item.achievement}</p>
                            {item.suggestedRecognition && (
                              <p className="text-xs text-success mt-1">{item.suggestedRecognition}</p>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Team Concerns */}
              {teamSummary.teamConcerns && teamSummary.teamConcerns.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    <h4 className="font-semibold">Team Concerns</h4>
                  </div>
                  <div className="space-y-3">
                    {teamSummary.teamConcerns.map((item, i) => (
                      <div key={i} className="p-3 rounded-lg bg-warning/5 border border-warning/20">
                        {typeof item === 'string' ? (
                          <p className="text-sm text-muted-foreground">{item}</p>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={item.severity === 'high' ? 'destructive' : item.severity === 'medium' ? 'default' : 'secondary'} className="text-xs">
                                {item.severity}
                              </Badge>
                              <Badge variant="outline" className="text-xs">{item.project}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{item.concern}</p>
                            {item.affectedMembers && (
                              <p className="text-xs text-warning mt-1">
                                Affected: {Array.isArray(item.affectedMembers) ? item.affectedMembers.join(', ') : item.affectedMembers}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Workload Observations */}
              {teamSummary.workloadObservations && teamSummary.workloadObservations.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-500" />
                    <h4 className="font-semibold">Workload Observations</h4>
                  </div>
                  <div className="space-y-3">
                    {teamSummary.workloadObservations.map((item, i) => (
                      <div key={i} className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                        <p className="text-sm text-muted-foreground">{item.observation}</p>
                        <p className="text-xs text-blue-500 mt-1">
                          Affected: {item.affectedMembers.join(', ')}
                        </p>
                        <div className="flex items-start gap-2 text-sm mt-2">
                          <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <span className="text-primary text-xs">{item.recommendation}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Support Needed */}
              {teamSummary.supportNeeded && teamSummary.supportNeeded.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-destructive" />
                    <h4 className="font-semibold">Support Needed</h4>
                  </div>
                  <div className="space-y-3">
                    {teamSummary.supportNeeded.map((item, i) => (
                      <div key={i} className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                        {typeof item === 'string' ? (
                          <p className="text-sm text-muted-foreground">{item}</p>
                        ) : (
                          <>
                            <p className="text-sm font-medium">{item.area}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Members: {item.members.join(', ')}
                            </p>
                            <p className="text-xs text-destructive mt-1">{item.suggestedSupport}</p>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Development Opportunities */}
              {teamSummary.developmentOpportunities && teamSummary.developmentOpportunities.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-purple-500" />
                    <h4 className="font-semibold">Development Opportunities</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {teamSummary.developmentOpportunities.map((item, i) => (
                      <div key={i} className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                        <span className="font-medium text-sm">{item.memberName}</span>
                        <p className="text-sm text-muted-foreground mt-1">{item.opportunity}</p>
                        <p className="text-xs text-purple-500 mt-1">{item.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Retention Risks */}
              {teamSummary.retentionRisks && teamSummary.retentionRisks.length > 0 && (
                <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <h4 className="font-semibold text-destructive">Retention Risks</h4>
                  </div>
                  <div className="space-y-3">
                    {teamSummary.retentionRisks.map((item, i) => (
                      <div key={i} className="p-3 rounded-lg bg-background/50 border border-white/10">
                        <p className="text-sm text-muted-foreground">{item.indicator}</p>
                        {item.members.length > 0 && (
                          <p className="text-xs text-destructive mt-1">
                            Members: {item.members.join(', ')}
                          </p>
                        )}
                        <div className="flex items-start gap-2 text-sm mt-2">
                          <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <span className="text-primary text-xs">{item.recommendedAction}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended HR Actions */}
              {teamSummary.recommendedHRActions && teamSummary.recommendedHRActions.length > 0 && (
                <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="h-5 w-5 text-blue-500" />
                    <h4 className="font-semibold">Recommended HR Actions</h4>
                  </div>
                  <div className="space-y-3">
                    {teamSummary.recommendedHRActions.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-white/10">
                        <Badge variant={item.priority === 'high' ? 'destructive' : 'default'} className="shrink-0 mt-0.5">
                          {item.priority}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium">{item.action}</p>
                          <p className="text-xs text-muted-foreground mt-1">{item.rationale}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* SS/CMS Team Feedbacks Section */}
      <Card className="glass-card border-white/10">
        <CardHeader className="border-b border-white/5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="section-label">Anonymous Feedback</p>
                <CardTitle className="text-2xl">SS/CMS Team Feedbacks</CardTitle>
              </div>
            </div>
            {/* Download options for Team Feedback section */}
            {permissions.canViewTeamFeedbackSummary && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={peopleWithFeedback.length === 0 && !teamSummary}
                    data-testid="button-download-team-feedback"
                  >
                    <Download className="h-4 w-4" />
                    Download
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportTeamFeedbackSummaryPDF} data-testid="menu-export-team-feedback-pdf" disabled={!teamSummary}>
                    <Users className="h-4 w-4 mr-2" />
                    Team Feedback Summary (PDF)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportTeamFeedbackCSV} data-testid="menu-export-team-feedback-csv" disabled={peopleWithFeedback.length === 0}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Team Feedback (CSV)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Warning banner when reports modified after summary generation - only for those who can see team summary */}
          {permissions.canViewTeamFeedbackSummary && reportsModifiedAfterSummary && teamSummary && (
            <div className="mb-4 p-3 rounded-lg bg-warning/10 border border-warning/30 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <p className="text-sm text-warning">
                Reports have been edited after the AI summary was generated. Consider regenerating the summary.
              </p>
            </div>
          )}

          {/* Team Feedback Summary Tile - Only visible to managers and admins */}
          {permissions.canViewTeamFeedbackSummary && (
            teamSummary ? (
              <div 
                className={`mb-6 p-4 rounded-lg cursor-pointer transition-all hover:border-blue-500/50 ${
                  teamSummary.overallTeamMorale === 'positive' ? 'bg-success/10 border border-success/30' :
                  teamSummary.overallTeamMorale === 'mixed' ? 'bg-warning/10 border border-warning/30' :
                  'bg-destructive/10 border border-destructive/30'
                }`}
                onClick={() => setShowTeamModal(true)}
                data-testid="tile-team-summary"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Users className="h-4 w-4 text-blue-500" />
                    </div>
                    <h4 className="font-semibold">Team Feedback AI Summary</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    {permissions.canGenerateAISummary && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          generateSummaryMutation.mutate();
                        }}
                        disabled={generateSummaryMutation.isPending}
                        className="gap-1 h-7 px-2"
                        data-testid="button-regenerate-team-summary"
                      >
                        {generateSummaryMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        <span className="text-xs">Regenerate</span>
                      </Button>
                    )}
                    <Badge className={`${
                      teamSummary.overallTeamMorale === 'positive' ? 'bg-success/10 text-success' :
                      teamSummary.overallTeamMorale === 'mixed' ? 'bg-warning/10 text-warning' :
                      'bg-destructive/10 text-destructive'
                    } border-0`}>
                      {teamSummary.overallTeamMorale === 'positive' && <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                      {teamSummary.overallTeamMorale === 'mixed' && <AlertTriangle className="h-3.5 w-3.5 mr-1" />}
                      {teamSummary.overallTeamMorale === 'concerning' && <AlertCircle className="h-3.5 w-3.5 mr-1" />}
                      Team Morale: {teamSummary.overallTeamMorale === 'positive' ? 'Positive' : 
                       teamSummary.overallTeamMorale === 'mixed' ? 'Mixed' : 'Concerning'}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{teamSummary.teamSummary}</p>
                <p className="text-xs text-blue-500 mt-2">Click to view full summary</p>
              </div>
            ) : permissions.canGenerateAISummary && (
              <div className="mb-6 p-4 rounded-lg bg-muted/30 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Users className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Team Feedback AI Summary</h4>
                    <p className="text-xs text-muted-foreground">Generate AI insights from team feedback</p>
                  </div>
                </div>
                <Button
                  onClick={() => generateSummaryMutation.mutate()}
                  disabled={generateSummaryMutation.isPending}
                  size="sm"
                  className="gap-2"
                  data-testid="button-generate-summary-team"
                >
                  {generateSummaryMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            )
          )}

          {/* Auto-archive schedule banner - only for managers and admins */}
          {permissions.canViewAllFeedback && (
            <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-start gap-3">
              <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-primary mb-1">Automatic Archive Schedule</p>
                <p className="text-muted-foreground">
                  Feedbacks are automatically archived and reset every <span className="text-primary font-medium">Wednesday at 00:00 UTC</span>.
                  {isAutoArchiving && <span className="ml-2 text-primary">(Auto-archiving in progress...)</span>}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Next auto-archive: <span className="text-foreground">{nextWedFormatted} 00:00 UTC</span>
                </p>
              </div>
            </div>
          )}

          {(() => {
            // For admins/managers: show all feedback grouped by person (existing peopleWithFeedback)
            // For leads/members: show their submitted feedback entries from feedbackEntries API
            
            if (permissions.canViewAllFeedback) {
              // Admins and managers see all feedback grouped by person
              return peopleWithFeedback.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium mb-2">No feedback submitted yet</p>
                  <p className="text-sm">Anonymous feedback submitted about team members and leads will appear here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    Anonymous feedback submitted by colleagues who worked with these individuals. This feedback is used to generate the SS/CMS Team Feedback Summary.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(showAllFeedback ? peopleWithFeedback : peopleWithFeedback.slice(0, 8)).map((person) => (
                      <div 
                        key={person.id}
                        className="p-4 rounded-lg bg-muted/30 border border-white/5"
                        data-testid={`feedback-card-${person.id}`}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-medium text-sm">{person.name}</h4>
                            <p className="text-xs text-muted-foreground">
                              {person.roles?.includes('project-lead') ? 'Team Lead' : 'Team Member'}
                            </p>
                          </div>
                        </div>
                        <div className="p-3 bg-background/50 rounded-md max-h-32 overflow-y-auto">
                          <p className="text-sm whitespace-pre-wrap">{person.feedback}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {peopleWithFeedback.length > 8 && (
                    <div className="flex justify-center pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAllFeedback(!showAllFeedback)}
                        className="gap-2"
                        data-testid="button-toggle-feedback"
                      >
                        {showAllFeedback ? (
                          <>
                            <ChevronUp className="h-4 w-4" />
                            Show Less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            Show More ({peopleWithFeedback.length - 8} more)
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              );
            } else {
              // Leads and members see only their own submitted feedback entries
              return feedbackEntries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium mb-2">No feedback submitted by you yet</p>
                  <p className="text-sm">Feedback you submit about team members and leads will appear here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    Feedback you have submitted about team members and leads. Your submissions are tracked here for your reference.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(showAllFeedback ? feedbackEntries : feedbackEntries.slice(0, 8)).map((entry) => {
                      const aboutPerson = allPeople.find(p => p.id === entry.aboutPersonId);
                      return (
                        <div 
                          key={entry.id}
                          className="p-4 rounded-lg bg-muted/30 border border-white/5"
                          data-testid={`feedback-entry-${entry.id}`}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-medium text-sm">{aboutPerson?.name || 'Unknown'}</h4>
                              <p className="text-xs text-muted-foreground">
                                {aboutPerson?.roles?.includes('project-lead') ? 'Team Lead' : 'Team Member'}
                              </p>
                            </div>
                          </div>
                          <div className="p-3 bg-background/50 rounded-md max-h-32 overflow-y-auto">
                            <p className="text-sm whitespace-pre-wrap">{entry.feedback}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {feedbackEntries.length > 8 && (
                    <div className="flex justify-center pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAllFeedback(!showAllFeedback)}
                        className="gap-2"
                        data-testid="button-toggle-feedback"
                      >
                        {showAllFeedback ? (
                          <>
                            <ChevronUp className="h-4 w-4" />
                            Show Less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            Show More ({feedbackEntries.length - 8} more)
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              );
            }
          })()}
        </CardContent>
      </Card>

      <Card id="weekly-reports-section" className="glass-card border-white/10">
        <CardHeader className="border-b border-white/5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="section-label">Weekly Reports</p>
                <CardTitle 
                  className="text-2xl cursor-pointer hover:text-primary transition-colors"
                  onClick={clearAllFilters}
                  data-testid="title-weekly-reports"
                >
                  Account Reports <span className="text-primary">({filteredReports.length})</span>
                </CardTitle>
              </div>
              <div className="flex flex-wrap gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2" data-testid="button-filter">
                      <Filter className="h-4 w-4" />
                      Filter
                      {activeFilterCount > 0 && (
                        <Badge variant="secondary" className="ml-1">
                          {activeFilterCount}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="end">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Filters</h4>
                        {activeFilterCount > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearAllFilters}
                            className="h-auto p-1 text-xs text-muted-foreground"
                            data-testid="button-clear-filters"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Clear all
                          </Button>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">By Health Status</Label>
                        <div className="space-y-1">
                          {[
                            { value: 'all', label: 'All Health Status' },
                            { value: 'on-track', label: 'On Track' },
                            { value: 'at-risk', label: 'Needs Attention' },
                            { value: 'critical', label: 'Critical' },
                          ].map((option) => (
                            <div
                              key={option.value}
                              className="flex items-center gap-2 p-1 hover-elevate rounded cursor-pointer"
                              onClick={() => handleHealthFilterChange(option.value)}
                            >
                              <Checkbox
                                checked={filterHealth === option.value}
                                onCheckedChange={() => handleHealthFilterChange(option.value)}
                                data-testid={`checkbox-health-${option.value}`}
                              />
                              <span className="text-sm">{option.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">By Project Status</Label>
                        <div className="space-y-1">
                          {projectStatusOptions.map((option) => (
                            <div
                              key={option.value}
                              className="flex items-center gap-2 p-1 hover-elevate rounded cursor-pointer"
                              onClick={() => setFilterProjectStatus(option.value)}
                            >
                              <Checkbox
                                checked={filterProjectStatus === option.value}
                                onCheckedChange={() => setFilterProjectStatus(option.value)}
                                data-testid={`checkbox-project-status-${option.value}`}
                              />
                              <span className="text-sm">{option.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">By Lead</Label>
                        <Input
                          placeholder="Search leads..."
                          value={leadSearch}
                          onChange={(e) => setLeadSearch(e.target.value)}
                          className="h-8"
                          data-testid="input-lead-search"
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
                                  checked={filterLeads.has(lead.id)}
                                  onCheckedChange={() => toggleLeadFilter(lead.id)}
                                  data-testid={`checkbox-lead-${lead.id}`}
                                />
                                <span className="text-sm">{lead.name}</span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">By Member</Label>
                        <Input
                          placeholder="Search members..."
                          value={memberSearch}
                          onChange={(e) => setMemberSearch(e.target.value)}
                          className="h-8"
                          data-testid="input-member-search"
                        />
                        <ScrollArea className="h-[160px] scrollbar-visible">
                          <div className="space-y-1">
                            {filteredMembersForSearch.map((member) => (
                              <div
                                key={member.id}
                                className="flex items-center gap-2 p-1 hover-elevate rounded cursor-pointer"
                                onClick={() => toggleMemberFilter(member.id)}
                              >
                                <Checkbox
                                  checked={filterMembers.has(member.id)}
                                  onCheckedChange={() => toggleMemberFilter(member.id)}
                                  data-testid={`checkbox-member-${member.id}`}
                                />
                                <span className="text-sm">{member.name}</span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={sortedReports.length === 0}
                      data-testid="button-download"
                    >
                      <Download className="h-4 w-4" />
                      Download
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportLeadershipSummaryPDF} data-testid="menu-export-leadership-pdf" disabled={!aiSummary}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Leadership Summary (PDF)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportAccountReportsCSV} data-testid="menu-export-account-csv">
                      <FileDown className="h-4 w-4 mr-2" />
                      Account Reports (CSV)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {permissions.canArchiveReports && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-orange-500/50 text-orange-500 hover:bg-orange-500/10 hover:text-orange-400"
                    onClick={saveToArchive}
                    disabled={sortedReports.length === 0 || isForceArchiving}
                    data-testid="button-archive"
                  >
                    <Archive className="h-4 w-4" />
                    {isForceArchiving ? 'Archiving...' : 'Force Archive'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Warning banner when reports modified after summary generation */}
          {reportsModifiedAfterSummary && aiSummary && (
            <div className="mb-4 p-3 rounded-lg bg-warning/10 border border-warning/30 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <p className="text-sm text-warning">
                Reports have been edited after the AI summary was generated. Consider regenerating the summary.
              </p>
            </div>
          )}

          {/* Leadership Summary Tile - Moved from AI Summary section */}
          {aiSummary ? (
            <div 
              className={`mb-6 p-4 rounded-lg cursor-pointer transition-all hover:border-primary/50 ${getOverallHealthConfig(aiSummary.overallHealth).bgColor} border ${getOverallHealthConfig(aiSummary.overallHealth).borderColor}`}
              onClick={() => setShowLeadershipModal(true)}
              data-testid="tile-leadership-summary"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <h4 className="font-semibold">Leadership AI Summary</h4>
                </div>
                <div className="flex items-center gap-2">
                  {permissions.canGenerateAISummary && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        generateSummaryMutation.mutate();
                      }}
                      disabled={generateSummaryMutation.isPending}
                      className="gap-1 h-7 px-2"
                      data-testid="button-regenerate-summary"
                    >
                      {generateSummaryMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      <span className="text-xs">Regenerate</span>
                    </Button>
                  )}
                  <Badge className={`${getOverallHealthConfig(aiSummary.overallHealth).bgColor} ${getOverallHealthConfig(aiSummary.overallHealth).color} border-0`}>
                    {aiSummary.overallHealth === 'on-track' && <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                    {aiSummary.overallHealth === 'needs-attention' && <AlertTriangle className="h-3.5 w-3.5 mr-1" />}
                    {aiSummary.overallHealth === 'critical' && <AlertCircle className="h-3.5 w-3.5 mr-1" />}
                    {getOverallHealthConfig(aiSummary.overallHealth).label}
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{aiSummary.executiveSummary}</p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-primary">Click to view full summary</p>
                <p className="text-xs text-muted-foreground">Analyzed {reportsAnalyzed} reports</p>
              </div>
            </div>
          ) : permissions.canGenerateAISummary && (
            <div className="mb-6 p-4 rounded-lg bg-muted/30 border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Leadership AI Summary</h4>
                  <p className="text-xs text-muted-foreground">Generate AI insights from account reports</p>
                </div>
              </div>
              <Button
                onClick={() => generateSummaryMutation.mutate()}
                disabled={generateSummaryMutation.isPending}
                size="sm"
                className="gap-2"
                data-testid="button-generate-summary-account"
              >
                {generateSummaryMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Auto-archive schedule banner */}
          <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-start gap-3">
            <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-primary mb-1">Automatic Archive Schedule</p>
              <p className="text-muted-foreground">
                Reports are automatically archived and reset every <span className="text-primary font-medium">Wednesday at 00:00 UTC</span>.
                {isAutoArchiving && <span className="ml-2 text-primary">(Auto-archiving in progress...)</span>}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Next auto-archive: <span className="text-foreground">{nextWedFormatted} 00:00 UTC</span>
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {sortedLeadNames.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No reports found matching the filters.</p>
            ) : (
              (() => {
                // Calculate total reports for stats
                const totalReports = sortedLeadNames.reduce((sum, leadName) => 
                  sum + groupedReportsByLead[leadName].length, 0);
                
                // Count how many leads have more than 2 reports (can be expanded)
                const leadsWithMoreThan2 = sortedLeadNames.filter(leadName => 
                  groupedReportsByLead[leadName].length > 2).length;
                
                return (
                  <>
                    {sortedLeadNames.map((leadName) => {
                      // Get the FULL list of reports for this lead (not pre-truncated)
                      const leadReports = groupedReportsByLead[leadName];
                      const totalLeadReports = leadReports.length;
                      const isLeadSectionExpanded = expandedLeadSections.has(leadName) || showAllReports;
                      const displayedLeadReports = isLeadSectionExpanded ? leadReports : leadReports.slice(0, 2);
                      const hasMoreReports = totalLeadReports > 2;
                      
                      const toggleLeadSection = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        // If global "Expand All" is active and user clicks "Show Less", 
                        // turn off global expand and expand all sections EXCEPT this one
                        if (showAllReports && isLeadSectionExpanded) {
                          setShowAllReports(false);
                          // Expand all leads except this one
                          const allLeadsExceptThis = sortedLeadNames.filter(name => 
                            name !== leadName && groupedReportsByLead[name].length > 2
                          );
                          setExpandedLeadSections(new Set(allLeadsExceptThis));
                        } else {
                          setExpandedLeadSections(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(leadName)) {
                              newSet.delete(leadName);
                            } else {
                              newSet.add(leadName);
                            }
                            return newSet;
                          });
                        }
                      };
                      
                      return (
                        <div key={leadName} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{leadName}</h3>
                            <Badge variant="default" className="gap-1">
                              {totalLeadReports} {totalLeadReports === 1 ? 'report' : 'reports'}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {displayedLeadReports.map((report) => {
                        const healthConfig = healthStatusConfig[report.healthStatus as keyof typeof healthStatusConfig];
                        const HealthIcon = healthConfig?.icon || CheckCircle2;
                        const feedback = report.teamMemberFeedback as TeamMemberFeedback[] | null;
                        const project = projects.find(p => p.id === report.projectId);
                        const isCoLead = project && hasCoLeads(project);

                        return (
                          <Card 
                            key={report.id} 
                            data-testid={`report-${report.id}`} 
                            className={`glass-card border-white/10 ${editingId !== report.id ? 'cursor-pointer hover:border-primary/30 transition-all' : ''}`}
                            onClick={() => handleReportClick(report)}
                          >
                            <CardHeader className="border-b border-white/5">
                              <div className="flex justify-between items-start gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <CardTitle className="text-lg">
                                      {getProjectName(report.projectId)}
                                    </CardTitle>
                                    {isCoLead && (
                                      <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                                        Co-Lead
                                      </Badge>
                                    )}
                                    {healthConfig && (
                                      <Badge variant="outline" className={`gap-1 ${healthConfig.color.replace('text-', 'border-').replace('-600', '-500/50')}`}>
                                        <HealthIcon className={`h-3 w-3 ${healthConfig.color}`} />
                                        <span className={healthConfig.color}>{healthConfig.label}</span>
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    Week of <span className="text-primary">{report.weekStart}</span>
                                    {isCoLead && getSubmittedByName(report) && (
                                      <span className="text-xs text-muted-foreground/70"> • submitted by {getSubmittedByName(report)}</span>
                                    )}
                                  </p>
                                </div>
                                {editingId !== report.id && (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      data-testid={`button-edit-report-${report.id}`}
                                      size="icon"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        startEdit(report);
                                      }}
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    {permissions.canDeleteReports && (
                                      <AlertDialog open={deletingReportId === report.id} onOpenChange={(open) => !open && setDeletingReportId(null)}>
                                        <AlertDialogTrigger asChild>
                                          <Button
                                            data-testid={`button-delete-report-${report.id}`}
                                            size="icon"
                                            variant="ghost"
                                            className="text-destructive hover:text-destructive"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDeletingReportId(report.id);
                                            }}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Delete Report</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Are you sure you want to delete this report for <strong>{getProjectName(report.projectId)}</strong>? 
                                              The project will return to pending status and you'll need to submit a new report.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel data-testid="button-cancel-delete-report">Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                              data-testid="button-confirm-delete-report"
                                              className="bg-destructive hover:bg-destructive/90"
                                              onClick={() => deleteReportMutation.mutate(report.id)}
                                              disabled={deleteReportMutation.isPending}
                                            >
                                              {deleteReportMutation.isPending ? 'Deleting...' : 'Delete Report'}
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    )}
                                  </div>
                                )}
                              </div>
                            </CardHeader>
                    <CardContent className="space-y-4">
                      {editingId === report.id ? (
                        <>
                          <div className="space-y-2">
                            <Label>Health Status</Label>
                            <Select
                              value={editData.healthStatus}
                              onValueChange={(value) =>
                                setEditData({ ...editData, healthStatus: value })
                              }
                            >
                              <SelectTrigger data-testid={`select-edit-health-${report.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="on-track">On Track</SelectItem>
                                <SelectItem value="at-risk">Needs Attention</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Progress This Week</Label>
                            <Textarea
                              data-testid={`textarea-edit-progress-${report.id}`}
                              value={editData.progress}
                              onChange={(e) =>
                                setEditData({ ...editData, progress: e.target.value })
                              }
                              rows={3}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Challenges & Blockers</Label>
                            <Textarea
                              data-testid={`textarea-edit-challenges-${report.id}`}
                              value={editData.challenges}
                              onChange={(e) =>
                                setEditData({ ...editData, challenges: e.target.value })
                              }
                              rows={3}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Plans for Next Week</Label>
                            <Textarea
                              data-testid={`textarea-edit-next-week-${report.id}`}
                              value={editData.nextWeek}
                              onChange={(e) =>
                                setEditData({ ...editData, nextWeek: e.target.value })
                              }
                              rows={3}
                            />
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              data-testid={`button-save-edit-${report.id}`}
                              onClick={() => saveEdit(report.id)}
                              disabled={editReportMutation.isPending}
                              className="gap-2"
                            >
                              <Save className="h-4 w-4" />
                              {editReportMutation.isPending ? 'Saving...' : 'Save'}
                            </Button>
                            <Button
                              data-testid={`button-cancel-edit-${report.id}`}
                              variant="outline"
                              onClick={cancelEdit}
                              className="gap-2"
                            >
                              <X className="h-4 w-4" />
                              Cancel
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Progress Section */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-success" />
                              <h4 className="font-medium text-sm">Progress This Week</h4>
                            </div>
                            <div className="pl-4 border-l-2 border-success/30">
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                {report.progress || 'No progress recorded'}
                              </p>
                            </div>
                          </div>

                          {/* Challenges Section */}
                          {report.challenges && (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-warning" />
                                <h4 className="font-medium text-sm">Challenges & Blockers</h4>
                              </div>
                              <div className="pl-4 border-l-2 border-warning/30">
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                  {report.challenges}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Next Week Section */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-primary" />
                              <h4 className="font-medium text-sm">Plans for Next Week</h4>
                            </div>
                            <div className="pl-4 border-l-2 border-primary/30">
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                {report.nextWeek || 'No plans recorded'}
                              </p>
                            </div>
                          </div>

                          {/* Team Feedback Section */}
                          {feedback && feedback.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-white/5">
                              <div className="flex items-center gap-2">
                                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                <h4 className="font-medium text-sm">Team Member Feedback</h4>
                              </div>
                              <div className="space-y-2">
                                {feedback.map((f, index) => (
                                  <div key={index} className="p-2 rounded-md bg-muted/20 border-l-2 border-primary/40">
                                    <p className="text-xs font-medium text-primary">{getMemberName(f.memberId)}</p>
                                    <p className="text-sm text-muted-foreground">{f.feedback}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <p className="text-xs text-muted-foreground pt-2 border-t border-white/5">
                            <Clock className="h-3 w-3 inline mr-1" />
                            Submitted: {new Date(report.submittedAt).toLocaleString()}
                          </p>
                        </>
                      )}
                    </CardContent>
                  </Card>
                            );
                          })}
                          </div>
                          {/* Show More/Less for this lead section */}
                          {hasMoreReports && (
                            <div className="flex justify-center pt-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={toggleLeadSection}
                                className="gap-2 text-muted-foreground hover:text-foreground"
                                data-testid={`button-toggle-lead-${leadName.replace(/\s+/g, '-').toLowerCase()}`}
                              >
                                {isLeadSectionExpanded ? (
                                  <>
                                    <ChevronUp className="h-4 w-4" />
                                    Show Less
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-4 w-4" />
                                    Show More ({totalLeadReports - 2} more)
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                    );
                  })}
                  
                  {/* Expand All / Collapse All Button - shown when there are leads with more than 2 reports */}
                  {leadsWithMoreThan2 > 1 && (
                    <div className="flex justify-center pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAllReports(!showAllReports)}
                        className="gap-2"
                        data-testid="button-toggle-all-reports"
                      >
                        {showAllReports ? (
                          <>
                            <ChevronUp className="h-4 w-4" />
                            Collapse All Sections
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            Expand All Sections
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </>
              );
            })()
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report Detail Modal */}
      <Dialog open={showReportDetailModal} onOpenChange={(open) => !open && closeReportDetailModal()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedReport && (() => {
            const healthConfig = healthStatusConfig[selectedReport.healthStatus as keyof typeof healthStatusConfig];
            const HealthIcon = healthConfig?.icon || CheckCircle2;
            const feedback = selectedReport.teamMemberFeedback as TeamMemberFeedback[] | null;
            const project = projects.find(p => p.id === selectedReport.projectId);
            const projectMembers = project ? ((project.teamMembers as TeamMemberAssignment[]) || []).map(a => a.memberId) : [];
            
            return (
              <>
                <DialogHeader className="pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <DialogTitle className="text-2xl font-bold">
                        {getProjectName(selectedReport.projectId)}
                      </DialogTitle>
                      {healthConfig && (
                        <Badge className={`gap-1.5 ${healthConfig.bgColor} ${healthConfig.color} border-0`}>
                          <HealthIcon className="h-4 w-4" />
                          {healthConfig.label}
                        </Badge>
                      )}
                    </div>
                  </div>
                </DialogHeader>

                <div className="space-y-6">
                  {/* Report Metadata */}
                  <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Week Starting</p>
                        <p className="font-medium text-primary">{selectedReport.weekStart}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {project && hasCoLeads(project) ? 'Team Leads' : 'Team Lead'}
                        </p>
                        <p className="font-medium">
                          {project ? getProjectLeadNames(project) : getLeadName(selectedReport.leadId)}
                        </p>
                        {project && hasCoLeads(project) && getSubmittedByName(selectedReport) && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Submitted by {getSubmittedByName(selectedReport)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Submitted</p>
                        <p className="font-medium">{new Date(selectedReport.submittedAt).toLocaleString()}</p>
                      </div>
                    </div>
                    {projectMembers.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Team Members</p>
                          <p className="font-medium">{projectMembers.length}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Progress Section */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-success" />
                      <h3 className="font-semibold text-lg">Progress This Week</h3>
                    </div>
                    <div className="pl-4 border-l-2 border-success/30">
                      <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {selectedReport.progress || 'No progress recorded'}
                      </p>
                    </div>
                  </div>

                  {/* Challenges Section */}
                  {selectedReport.challenges && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-warning" />
                        <h3 className="font-semibold text-lg">Challenges & Blockers</h3>
                      </div>
                      <div className="pl-4 border-l-2 border-warning/30">
                        <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {selectedReport.challenges}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Next Week Section */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <h3 className="font-semibold text-lg">Plans for Next Week</h3>
                    </div>
                    <div className="pl-4 border-l-2 border-primary/30">
                      <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {selectedReport.nextWeek || 'No plans recorded'}
                      </p>
                    </div>
                  </div>

                  {/* Team Feedback Section */}
                  {feedback && feedback.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <h3 className="font-semibold text-lg">Team Member Feedback</h3>
                        </div>
                        <div className="space-y-3">
                          {feedback.map((f, index) => (
                            <div key={index} className="p-3 rounded-lg bg-muted/30 border-l-2 border-primary/50">
                              <p className="font-medium text-sm text-primary mb-1">{getMemberName(f.memberId)}</p>
                              <p className="text-sm text-muted-foreground">{f.feedback}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
