import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
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
import { Edit2, X, CheckCircle2, AlertTriangle, AlertCircle, FileDown, FileText, Filter, ChevronDown, Calendar, User, Users, Clock, Sparkles, TrendingUp, Target, Lightbulb, Loader2, Archive, Download, Save, Info } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { WeeklyReport, ProjectLead, TeamMember, Project, TeamMemberFeedback, SavedReport, TeamMemberAssignment } from '@shared/schema';

const healthStatusConfig = {
  'on-track': { label: 'On Track', icon: CheckCircle2, color: 'text-success', bgColor: 'bg-success/10' },
  'at-risk': { label: 'Needs Attention', icon: AlertTriangle, color: 'text-warning', bgColor: 'bg-warning/10' },
  'critical': { label: 'Critical', icon: AlertCircle, color: 'text-destructive', bgColor: 'bg-destructive/10' },
};

interface ViewReportsProps {
  externalHealthFilter?: string;
  onClearExternalFilter?: () => void;
}

export default function ViewReports({ externalHealthFilter, onClearExternalFilter }: ViewReportsProps) {
  const { toast } = useToast();
  const { data: weeklyReports = [] } = useQuery<WeeklyReport[]>({ queryKey: ['/api/weekly-reports'] });
  const { data: projectLeads = [] } = useQuery<ProjectLead[]>({ queryKey: ['/api/project-leads'] });
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({ queryKey: ['/api/team-members'] });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ['/api/projects'] });
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

  // AI Summary State
  interface AISummary {
    overallHealth: 'on-track' | 'needs-attention' | 'critical';
    weekHighlights: string[];
    keyAchievements: string[];
    criticalIssues: string[];
    attentionNeeded: string[];
    upcomingFocus: string[];
    executiveSummary: string;
  }
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [summaryGeneratedAt, setSummaryGeneratedAt] = useState<string | null>(null);
  const [reportsAnalyzed, setReportsAnalyzed] = useState<number>(0);
  
  // Auto-archive tracking
  const autoArchiveTriggered = useRef(false);
  const [isAutoArchiving, setIsAutoArchiving] = useState(false);

  // Get current week start from reports
  const currentWeekStart = weeklyReports.length > 0 ? weeklyReports[0].weekStart : null;

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
  interface SavedAiSummaryResponse {
    summary: AISummary | null;
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
      setAiSummary(savedAiSummary.summary);
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
      
      // Calculate the Monday of the current week
      const currentMonday = new Date(now);
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      currentMonday.setUTCDate(now.getUTCDate() + diffToMonday);
      currentMonday.setUTCHours(0, 0, 0, 0);
      const currentWeekMonday = currentMonday.toISOString().split('T')[0];
      
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
          
          // ALWAYS generate AI summary before archiving if one doesn't exist
          let summaryToArchive = aiSummary;
          if (!summaryToArchive) {
            console.log('Auto-archive: Generating AI summary before archiving...');
            try {
              const summaryResponse = await apiRequest('POST', '/api/weekly-reports/ai-summary');
              const summaryData = await summaryResponse.json();
              if (summaryData.summary) {
                summaryToArchive = summaryData.summary;
                // Update local state with the generated summary
                setAiSummary(summaryData.summary);
                setSummaryGeneratedAt(summaryData.generatedAt);
                setReportsAnalyzed(summaryData.reportsAnalyzed || 0);
              }
            } catch (summaryError) {
              console.error('Failed to generate AI summary for auto-archive:', summaryError);
              // Continue with archiving even if summary generation fails
            }
          }
          
          // Generate PDF and CSV for auto-archive (same as manual Force Archive)
          console.log('Auto-archive: Generating PDF and CSV...');
          const submittedReports = weeklyReports.filter(r => r.status === 'submitted');
          const pdfBase64 = generatePDFBase64(submittedReports, weekEnd, summaryToArchive);
          const csvContent = generateCSVForReports(submittedReports);
          
          // Calculate health counts from submitted reports only (same as Force Archive)
          const healthCounts = {
            onTrack: submittedReports.filter(r => r.healthStatus === 'on-track').length,
            needsAttention: submittedReports.filter(r => r.healthStatus === 'at-risk').length,
            critical: submittedReports.filter(r => r.healthStatus === 'critical').length,
          };
          
          // Archive via API with full PDF and CSV data
          await apiRequest('POST', '/api/saved-reports', {
            weekStart: reportWeekStart,
            weekEnd: weekEnd,
            reportCount: String(submittedReports.length),
            healthCounts,
            aiSummary: summaryToArchive || null,
            pdfData: pdfBase64,
            csvData: csvContent,
          });
          
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
          
          // Clear local state
          setAiSummary(null);
          setSummaryGeneratedAt(null);
          setReportsAnalyzed(0);
          
          toast({
            title: 'Auto-Archive Complete',
            description: `Previous week's ${weeklyReports.length} reports have been archived${summaryToArchive ? ' with AI summary' : ''} and reset for the new week.`,
          });
        } catch (error) {
          console.error('Auto-archive failed:', error);
          toast({
            title: 'Auto-Archive Failed',
            description: 'Failed to auto-archive reports. Please use Force Archive manually.',
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
        setSummaryGeneratedAt(data.generatedAt);
        setReportsAnalyzed(data.reportsAnalyzed || 0);
        // Invalidate the cache so it will be reloaded when navigating back
        queryClient.invalidateQueries({ queryKey: ['/api/current-ai-summary'] });
        toast({
          title: 'AI Summary Generated',
          description: `Analyzed ${data.reportsAnalyzed} reports successfully`,
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

  const filteredLeadsForSearch = projectLeads
    .filter(lead => lead.name.toLowerCase().includes(leadSearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const filteredMembersForSearch = teamMembers
    .filter(member => member.name.toLowerCase().includes(memberSearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Generate CSV content for export/archive
  const generateCSVContent = () => {
    const headers = ['Project', 'Lead(s)', 'Week Start', 'Health Status', 'Progress', 'Challenges', 'Next Week', 'Team Feedback', 'Submitted', 'Submitted By'];
    const rows = sortedReports.map((report) => {
      const project = projects.find(p => p.id === report.projectId);
      const feedback = report.teamMemberFeedback as TeamMemberFeedback[] | null;
      const feedbackText = feedback && feedback.length > 0
        ? feedback.map((f) => `${getMemberName(f.memberId)}: ${f.feedback}`).join('; ')
        : 'None';

      // Use co-lead names if available
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
        feedbackText.replace(/\n/g, ' '),
        new Date(report.submittedAt).toLocaleString(),
        submittedBy,
      ];
    });

    return [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');
  };

  const exportToCSV = () => {
    const csvContent = generateCSVContent();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `weekly_reports_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get current week's date range (Monday to Sunday)
  const getCurrentWeekDates = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    return { weekStart: formatDate(monday), weekEnd: formatDate(sunday) };
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
  const generatePDFBase64 = (reportsToUse: WeeklyReport[], weekEndDate: string, summaryToUse: AISummary | null): string => {
    const doc = new jsPDF({ orientation: 'landscape' });
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

    // AI Summary section if available
    if (summaryToUse) {
      doc.setFillColor(...colors.navyLight as [number, number, number]);
      doc.roundedRect(14, currentY, pageWidth - 28, 8, 2, 2, 'F');
      doc.setTextColor(...colors.primary as [number, number, number]);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('AI-Powered Weekly Insights', 18, currentY + 5.5);
      currentY += 12;
      
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'normal');
      const summaryLines = doc.splitTextToSize(summaryToUse.executiveSummary, pageWidth - 32);
      doc.text(summaryLines, 14, currentY);
      currentY += summaryLines.length * 4 + 8;
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

  // Generate CSV content for a given set of reports
  const generateCSVForReports = (reportsToUse: WeeklyReport[]): string => {
    const headers = ['Project', 'Lead', 'Week Start', 'Health Status', 'Progress', 'Challenges', 'Next Week', 'Team Feedback', 'Submitted'];
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

    return [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');
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
    const { weekEnd } = getCurrentWeekDates();
    const weekEndFormatted = new Date(weekEnd + 'T00:00:00').toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    doc.text(`Weekly Delivery Status Overview - Week Ending ${weekEndFormatted}`, 14, 26);
    
    doc.setTextColor(...colors.white as [number, number, number]);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 14, 18, { align: 'right' });

    let currentY = 45;

    // AI Summary Section (if available)
    if (aiSummary) {
      // AI Summary header
      doc.setFillColor(...colors.navyLight as [number, number, number]);
      doc.roundedRect(14, currentY, pageWidth - 28, 10, 2, 2, 'F');
      
      doc.setTextColor(...colors.primary as [number, number, number]);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('AI-Powered Weekly Insights', 18, currentY + 7);
      
      currentY += 14;
      
      // Overall health status badge
      const healthColors: Record<string, [number, number, number]> = {
        'on-track': colors.success as [number, number, number],
        'needs-attention': colors.warning as [number, number, number],
        'critical': colors.destructive as [number, number, number],
      };
      const healthColor = healthColors[aiSummary.overallHealth] || colors.muted as [number, number, number];
      const healthLabel = aiSummary.overallHealth === 'on-track' ? 'On Track' : 
                         aiSummary.overallHealth === 'needs-attention' ? 'Needs Attention' : 'Critical';
      
      doc.setFillColor(...healthColor);
      doc.roundedRect(14, currentY, 50, 7, 1.5, 1.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`Overall: ${healthLabel}`, 18, currentY + 5);
      
      doc.setTextColor(...colors.muted as [number, number, number]);
      doc.setFont('helvetica', 'normal');
      doc.text(`Based on ${reportsAnalyzed} report${reportsAnalyzed !== 1 ? 's' : ''}`, 68, currentY + 5);
      
      currentY += 12;
      
      // Executive Summary
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(9);
      const summaryLines = doc.splitTextToSize(aiSummary.executiveSummary, pageWidth - 32);
      doc.text(summaryLines, 14, currentY);
      currentY += summaryLines.length * 4 + 6;
      
      // Insights grid (2 columns)
      const insightSections = [
        { title: 'Key Achievements', items: aiSummary.keyAchievements, color: colors.success },
        { title: 'Week Highlights', items: aiSummary.weekHighlights, color: colors.primary },
        { title: 'Needs Attention', items: aiSummary.attentionNeeded, color: colors.warning },
        { title: 'Upcoming Focus', items: aiSummary.upcomingFocus, color: colors.primary },
      ].filter(s => s.items && s.items.length > 0);
      
      if (aiSummary.criticalIssues && aiSummary.criticalIssues.length > 0) {
        insightSections.unshift({ title: 'Critical Issues', items: aiSummary.criticalIssues, color: colors.destructive });
      }
      
      const colWidth = (pageWidth - 32) / 2;
      let leftY = currentY;
      let rightY = currentY;
      
      insightSections.forEach((section, idx) => {
        const isLeft = idx % 2 === 0;
        const x = isLeft ? 14 : 14 + colWidth + 4;
        let y = isLeft ? leftY : rightY;
        
        // Section title with colored dot
        doc.setFillColor(...section.color as [number, number, number]);
        doc.circle(x + 2, y + 2, 1.5, 'F');
        
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(section.title, x + 6, y + 3);
        y += 6;
        
        // Items
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(8);
        section.items.slice(0, 3).forEach((item) => {
          doc.setFillColor(...section.color as [number, number, number]);
          doc.circle(x + 3, y + 1.5, 0.8, 'F');
          const lines = doc.splitTextToSize(item, colWidth - 10);
          doc.text(lines, x + 7, y + 2);
          y += lines.length * 3.5 + 1;
        });
        
        y += 4;
        if (isLeft) leftY = y;
        else rightY = y;
      });
      
      currentY = Math.max(leftY, rightY) + 4;
      
      // Separator line
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

  // Track if Force Archive is in progress
  const [isForceArchiving, setIsForceArchiving] = useState(false);

  // Save current reports to archive (generates AI summary, PDF, CSV, archives, then resets)
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

      // Step 2: Generate AI summary if one doesn't exist
      let summaryToArchive = aiSummary;
      if (!summaryToArchive) {
        toast({
          title: 'Generating AI Summary',
          description: 'Please wait while we analyze the reports...',
        });
        try {
          const summaryResponse = await apiRequest('POST', '/api/weekly-reports/ai-summary');
          const summaryData = await summaryResponse.json();
          if (summaryData.summary) {
            summaryToArchive = summaryData.summary;
            setAiSummary(summaryData.summary);
            setSummaryGeneratedAt(summaryData.generatedAt);
            setReportsAnalyzed(summaryData.reportsAnalyzed || 0);
          }
        } catch (summaryError) {
          console.error('Failed to generate AI summary:', summaryError);
          // Continue without AI summary if it fails
        }
      }

      // Step 3: Generate PDF and CSV using the reusable functions
      const submittedReports = weeklyReports.filter(r => r.status === 'submitted');
      const pdfBase64 = generatePDFBase64(submittedReports, weekEnd, summaryToArchive);
      const csvContent = generateCSVForReports(submittedReports);

      // Step 4: Calculate health counts
      const healthCounts = {
        onTrack: submittedReports.filter(r => r.healthStatus === 'on-track').length,
        needsAttention: submittedReports.filter(r => r.healthStatus === 'at-risk').length,
        critical: submittedReports.filter(r => r.healthStatus === 'critical').length,
      };

      // Step 5: Archive via API
      await apiRequest('POST', '/api/saved-reports', {
        weekStart: reportWeekStart,
        weekEnd: weekEnd,
        reportCount: String(submittedReports.length),
        healthCounts,
        aiSummary: summaryToArchive || null,
        pdfData: pdfBase64,
        csvData: csvContent,
      });

      // Step 6: Reset - Delete all current reports and AI summary
      await apiRequest('DELETE', '/api/weekly-reports', {});
      if (currentWeekStart) {
        await apiRequest('DELETE', `/api/current-ai-summary/${currentWeekStart}`, {});
      }

      // Step 7: Invalidate queries and clear local state
      queryClient.invalidateQueries({ queryKey: ['/api/weekly-reports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/saved-reports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/current-ai-summary'] });
      
      setAiSummary(null);
      setSummaryGeneratedAt(null);
      setReportsAnalyzed(0);

      toast({
        title: 'Archive Complete',
        description: `Week ending ${weekEnd} has been archived${summaryToArchive ? ' with AI summary' : ''} and reports have been reset.`,
      });
    } catch (error) {
      console.error('Force archive failed:', error);
      toast({
        title: 'Archive Failed',
        description: 'Failed to archive reports. Please try again.',
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
      {/* AI Summary Section */}
      <Card className="glass-card border-white/10">
        <CardHeader className="border-b border-white/5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="section-label">AI-Powered Insights</p>
                <CardTitle className="text-2xl">Weekly Summary</CardTitle>
              </div>
            </div>
            <Button
              onClick={() => generateSummaryMutation.mutate()}
              disabled={generateSummaryMutation.isPending}
              className="gap-2"
              data-testid="button-generate-summary"
            >
              {generateSummaryMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing Reports...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate AI Summary
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Constant informational banner about AI summary costs */}
          <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-start gap-2">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Generate the AI summary only after all reports are submitted to avoid extra costs on GPT calls.
            </p>
          </div>

          {/* Warning banner when reports modified after summary generation */}
          {reportsModifiedAfterSummary && aiSummary && (
            <div className="mb-4 p-3 rounded-lg bg-warning/10 border border-warning/30 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <p className="text-sm text-warning">
                There are edits to the weekly reports after this summary was generated.
              </p>
            </div>
          )}

          {!aiSummary ? (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-2">No summary generated yet</p>
              <p className="text-sm">Click "Generate AI Summary" to analyze all submitted reports and get quick insights for the week.</p>
            </div>
          ) : (
            <div className="space-y-6">
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

              {/* Insights Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Week Highlights */}
                {aiSummary.weekHighlights.length > 0 && (
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

                {/* Key Achievements */}
                {aiSummary.keyAchievements.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <h4 className="font-medium">Key Achievements</h4>
                    </div>
                    <ul className="space-y-1.5">
                      {aiSummary.keyAchievements.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <div className="h-1.5 w-1.5 rounded-full bg-success mt-1.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Critical Issues */}
                {aiSummary.criticalIssues.length > 0 && (
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

                {/* Attention Needed */}
                {aiSummary.attentionNeeded.length > 0 && (
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

                {/* Upcoming Focus */}
                {aiSummary.upcomingFocus.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      <h4 className="font-medium">Upcoming Focus</h4>
                    </div>
                    <ul className="space-y-1.5">
                      {aiSummary.upcomingFocus.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Generated timestamp */}
              {summaryGeneratedAt && (
                <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-white/10 pt-3 mt-4">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Generated: {formatUTC(summaryGeneratedAt)}
                  </span>
                  <span>{reportsAnalyzed} reports analyzed</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="weekly-reports-section" className="glass-card border-white/10">
        <CardHeader className="border-b border-white/5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="section-label">Report Archive</p>
                <CardTitle 
                  className="text-2xl cursor-pointer hover:text-primary transition-colors"
                  onClick={clearAllFilters}
                  data-testid="title-weekly-reports"
                >
                  Weekly Reports <span className="text-primary">({filteredReports.length})</span>
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
                    <DropdownMenuItem onClick={exportToPDF} data-testid="menu-export-pdf">
                      <FileText className="h-4 w-4 mr-2" />
                      Download as PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportToCSV} data-testid="menu-export-csv">
                      <FileDown className="h-4 w-4 mr-2" />
                      Download as CSV
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

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
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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

          <div className="space-y-4">
            {sortedReports.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No reports found matching the filters.</p>
            ) : (
              sortedReports.map((report) => {
                const healthConfig = healthStatusConfig[report.healthStatus as keyof typeof healthStatusConfig];
                const HealthIcon = healthConfig?.icon || CheckCircle2;
                const feedback = report.teamMemberFeedback as TeamMemberFeedback[] | null;

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
                            {healthConfig && (
                              <Badge variant="outline" className={`gap-1 ${healthConfig.color.replace('text-', 'border-').replace('-600', '-500/50')}`}>
                                <HealthIcon className={`h-3 w-3 ${healthConfig.color}`} />
                                <span className={healthConfig.color}>{healthConfig.label}</span>
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Week of <span className="text-primary">{report.weekStart}</span> • Lead{(() => {
                              const project = projects.find(p => p.id === report.projectId);
                              return project && hasCoLeads(project) ? 's: ' : ': ';
                            })()}{(() => {
                              const project = projects.find(p => p.id === report.projectId);
                              return project ? getProjectLeadNames(project) : getLeadName(report.leadId);
                            })()}
                            {(() => {
                              const project = projects.find(p => p.id === report.projectId);
                              const submittedBy = getSubmittedByName(report);
                              if (project && hasCoLeads(project) && submittedBy) {
                                return <span className="text-xs text-muted-foreground/70"> (submitted by {submittedBy})</span>;
                              }
                              return null;
                            })()}
                          </p>
                        </div>
                        {editingId !== report.id && (
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
                          
                          {/* Team Member Feedback Edit Section */}
                          {(() => {
                            const project = projects.find(p => p.id === report.projectId);
                            if (!project) return null;
                            const projectTeamMembers = ((project.teamMembers as TeamMemberAssignment[]) || [])
                              .map(a => teamMembers.find(m => m.id === a.memberId))
                              .filter(Boolean) as typeof teamMembers;
                            if (projectTeamMembers.length === 0) return null;
                            
                            return (
                              <div className="space-y-3 pt-2 border-t border-white/10">
                                <Label className="flex items-center gap-2">
                                  <Users className="h-4 w-4" />
                                  Team Member Feedback (Optional)
                                </Label>
                                <div className="space-y-2">
                                  {projectTeamMembers.map((member) => {
                                    const existingFeedback = editData.teamMemberFeedback.find(f => f.memberId === member.id);
                                    return (
                                      <div key={member.id} className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">{member.name}</Label>
                                        <Textarea
                                          data-testid={`textarea-edit-feedback-${member.id}`}
                                          placeholder={`Feedback for ${member.name}...`}
                                          value={existingFeedback?.feedback || ''}
                                          onChange={(e) => {
                                            const newFeedback = e.target.value;
                                            setEditData(prev => {
                                              const existing = prev.teamMemberFeedback.filter(f => f.memberId !== member.id);
                                              if (newFeedback.trim()) {
                                                return {
                                                  ...prev,
                                                  teamMemberFeedback: [...existing, { memberId: member.id, feedback: newFeedback }]
                                                };
                                              }
                                              return { ...prev, teamMemberFeedback: existing };
                                            });
                                          }}
                                          rows={2}
                                          className="text-sm"
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                          
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
              })
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
                          {project && hasCoLeads(project) ? 'Project Leads' : 'Project Lead'}
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
