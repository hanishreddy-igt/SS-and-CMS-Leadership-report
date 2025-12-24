import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  FileDown, 
  FileText,
  Calendar,
  Sparkles,
  History,
  Trash2,
  Eye,
  BarChart3,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  Users,
  TrendingUp,
  Lightbulb,
  Target,
  RefreshCw,
  Loader2
} from 'lucide-react';
import type { SavedReport } from '@shared/schema';

// Comprehensive Leadership Summary interfaces
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
  portfolioHealthBreakdown?: PortfolioHealthBreakdown;
  immediateAttentionRequired?: AttentionItem[];
  keyAchievements?: AchievementItem[] | string[];
  crossProjectPatterns?: CrossProjectPatterns;
  upcomingFocus?: UpcomingFocusItem[] | string[];
  recommendedLeadershipActions?: LeadershipAction[];
  weekHighlights?: string[];
  criticalIssues?: string[];
  attentionNeeded?: string[];
  weekOverWeekChanges?: WeekOverWeekChanges;
  dependenciesAndCrossTeamNeeds?: DependencyItem[];
}

// Comprehensive Team Summary interfaces
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

interface DualSummary {
  leadership: AISummary;
  team: TeamSummary | null;
}

// Helper to parse saved report AI summary
// Now handles: 
// - New separate format: account reports have leadership summary, team reports have team summary
// - Legacy dual-summary format: { leadership: ..., team: ... }
// - Legacy single format: just leadership summary
// Also handles JSON strings that need parsing
function parseSavedSummary(aiSummaryData: unknown, reportType?: string): { leadership: AISummary | null; team: TeamSummary | null } {
  if (!aiSummaryData) return { leadership: null, team: null };
  
  // Handle JSON strings - parse them first
  let data: any;
  if (typeof aiSummaryData === 'string') {
    try {
      data = JSON.parse(aiSummaryData);
    } catch {
      return { leadership: null, team: null };
    }
  } else {
    data = aiSummaryData;
  }
  
  if (!data) return { leadership: null, team: null };
  
  // Check if it's the new dual-summary format (legacy combined)
  if (data.leadership && data.leadership.overallHealth) {
    return {
      leadership: data.leadership as AISummary,
      team: data.team || null
    };
  }
  
  // New separate format: for team reports, aiSummary is the team summary directly
  if (reportType === 'team' && data.overallTeamMorale) {
    return {
      leadership: null,
      team: data as TeamSummary
    };
  }
  
  // For account reports or legacy format - single leadership summary object
  if (data.overallHealth) {
    return {
      leadership: data as AISummary,
      team: null
    };
  }
  
  return { leadership: null, team: null };
}

interface GroupedReports {
  [year: string]: {
    [month: string]: SavedReport[];
  };
}

// Group reports by week for display (account + team reports together)
interface WeekGroup {
  weekStart: string;
  weekEnd: string;
  accountReport: SavedReport | null;
  teamReport: SavedReport | null;
}

const getOverallHealthConfig = (health: string) => {
  switch (health) {
    case 'on-track':
      return { 
        label: 'On Track', 
        color: 'text-success', 
        bgColor: 'bg-success/10', 
        borderColor: 'border-success/30',
        Icon: CheckCircle2
      };
    case 'needs-attention':
      return { 
        label: 'Needs Attention', 
        color: 'text-warning', 
        bgColor: 'bg-warning/10', 
        borderColor: 'border-warning/30',
        Icon: AlertTriangle
      };
    case 'critical':
      return { 
        label: 'Critical', 
        color: 'text-destructive', 
        bgColor: 'bg-destructive/10', 
        borderColor: 'border-destructive/30',
        Icon: AlertCircle
      };
    default:
      return { 
        label: 'Unknown', 
        color: 'text-muted-foreground', 
        bgColor: 'bg-muted/10', 
        borderColor: 'border-muted/30',
        Icon: CheckCircle2
      };
  }
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function HistoricalReports() {
  const { toast } = useToast();
  const permissions = usePermissions();
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  
  // Separate state for Account Reports section
  const [accountCalendarOpen, setAccountCalendarOpen] = useState(false);
  const [accountExpandedYears, setAccountExpandedYears] = useState<Set<string>>(new Set());
  const [accountExpandedMonths, setAccountExpandedMonths] = useState<Set<string>>(new Set());
  
  // Separate state for Team Reports section
  const [teamCalendarOpen, setTeamCalendarOpen] = useState(false);
  const [teamExpandedYears, setTeamExpandedYears] = useState<Set<string>>(new Set());
  const [teamExpandedMonths, setTeamExpandedMonths] = useState<Set<string>>(new Set());

  const { data: savedReports = [], isLoading } = useQuery<SavedReport[]>({ 
    queryKey: ['/api/saved-reports'] 
  });

  // Split reports by type
  const accountReports = useMemo(() => {
    return savedReports
      .filter(r => ((r as any).reportType || 'account') === 'account')
      .sort((a, b) => new Date(b.weekEnd).getTime() - new Date(a.weekEnd).getTime());
  }, [savedReports]);

  const teamReports = useMemo(() => {
    return savedReports
      .filter(r => (r as any).reportType === 'team')
      .sort((a, b) => new Date(b.weekEnd).getTime() - new Date(a.weekEnd).getTime());
  }, [savedReports]);

  // Group account reports by year and month
  const accountGroupedReports = useMemo(() => {
    const grouped: GroupedReports = {};
    accountReports.forEach(report => {
      const endDate = new Date(report.weekEnd);
      const year = endDate.getFullYear().toString();
      const month = MONTH_NAMES[endDate.getMonth()];
      if (!grouped[year]) grouped[year] = {};
      if (!grouped[year][month]) grouped[year][month] = [];
      grouped[year][month].push(report);
    });
    return grouped;
  }, [accountReports]);

  // Group team reports by year and month
  const teamGroupedReports = useMemo(() => {
    const grouped: GroupedReports = {};
    teamReports.forEach(report => {
      const endDate = new Date(report.weekEnd);
      const year = endDate.getFullYear().toString();
      const month = MONTH_NAMES[endDate.getMonth()];
      if (!grouped[year]) grouped[year] = {};
      if (!grouped[year][month]) grouped[year][month] = [];
      grouped[year][month].push(report);
    });
    return grouped;
  }, [teamReports]);

  // Sorted years for each section
  const accountSortedYears = useMemo(() => {
    return Object.keys(accountGroupedReports).sort((a, b) => parseInt(b) - parseInt(a));
  }, [accountGroupedReports]);

  const teamSortedYears = useMemo(() => {
    return Object.keys(teamGroupedReports).sort((a, b) => parseInt(b) - parseInt(a));
  }, [teamGroupedReports]);

  // Auto-expand the most recent year for each section
  useMemo(() => {
    if (accountSortedYears.length > 0 && accountExpandedYears.size === 0) {
      setAccountExpandedYears(new Set([accountSortedYears[0]]));
    }
  }, [accountSortedYears]);

  useMemo(() => {
    if (teamSortedYears.length > 0 && teamExpandedYears.size === 0) {
      setTeamExpandedYears(new Set([teamSortedYears[0]]));
    }
  }, [teamSortedYears]);

  // Toggle functions for Account section
  const toggleAccountYear = (year: string) => {
    const newExpanded = new Set(accountExpandedYears);
    if (newExpanded.has(year)) {
      newExpanded.delete(year);
    } else {
      newExpanded.add(year);
    }
    setAccountExpandedYears(newExpanded);
  };

  const toggleAccountMonth = (yearMonth: string) => {
    const newExpanded = new Set(accountExpandedMonths);
    if (newExpanded.has(yearMonth)) {
      newExpanded.delete(yearMonth);
    } else {
      newExpanded.add(yearMonth);
    }
    setAccountExpandedMonths(newExpanded);
  };

  // Toggle functions for Team section
  const toggleTeamYear = (year: string) => {
    const newExpanded = new Set(teamExpandedYears);
    if (newExpanded.has(year)) {
      newExpanded.delete(year);
    } else {
      newExpanded.add(year);
    }
    setTeamExpandedYears(newExpanded);
  };

  const toggleTeamMonth = (yearMonth: string) => {
    const newExpanded = new Set(teamExpandedMonths);
    if (newExpanded.has(yearMonth)) {
      newExpanded.delete(yearMonth);
    } else {
      newExpanded.add(yearMonth);
    }
    setTeamExpandedMonths(newExpanded);
  };

  const deleteArchivedReportMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/saved-reports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-reports'] });
      setSelectedReport(null);
      setShowPdfModal(false);
      toast({
        title: 'Archived Report Deleted',
        description: 'The archived report has been removed',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete archived report',
        variant: 'destructive',
      });
    }
  });

  const regenerateAISummaryMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('POST', `/api/saved-reports/${id}/regenerate-summary`);
    },
    onSuccess: (data: any) => {
      // Invalidate cache to get fresh data
      queryClient.invalidateQueries({ queryKey: ['/api/saved-reports'] });
      
      // Only update state if we got a valid response with the updated report
      if (data.report) {
        setSelectedReport(data.report);
        toast({
          title: 'AI Summary Regenerated',
          description: 'The AI summary has been successfully regenerated from the archived data',
        });
      } else if (data.aiSummary || data.teamSummary) {
        // Fallback: if report not included, refetch to get updated data
        // Close modal and let user reopen to see updated data
        setShowPdfModal(false);
        setSelectedReport(null);
        toast({
          title: 'AI Summary Regenerated',
          description: 'Please reopen the report to view the updated summary',
        });
      } else {
        // Unexpected response format
        toast({
          title: 'Regeneration Complete',
          description: 'Please refresh the page to see the updated summary',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Regeneration Failed',
        description: error.message || 'Failed to regenerate AI summary',
        variant: 'destructive',
      });
    }
  });

  const downloadPDF = (report: SavedReport) => {
    const reportType = (report as any).reportType || 'account';
    const typeLabel = reportType === 'team' ? 'team_feedback' : 'leadership';
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${report.pdfData}`;
    link.download = `${typeLabel}_summary_${report.weekEnd}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadCSV = (report: SavedReport) => {
    if (!report.csvData) {
      toast({
        title: 'No CSV Data',
        description: 'This archived report does not have CSV data',
        variant: 'destructive',
      });
      return;
    }
    const reportType = (report as any).reportType || 'account';
    const typeLabel = reportType === 'team' ? 'team_feedback' : 'account_reports';
    const blob = new Blob([report.csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${typeLabel}_${report.weekEnd}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleTileClick = (report: SavedReport) => {
    setSelectedReport(report);
    setShowPdfModal(true);
  };

  const handleAccountCalendarSelect = (report: SavedReport) => {
    setSelectedReport(report);
    setShowPdfModal(true);
    setAccountCalendarOpen(false);
  };

  const handleTeamCalendarSelect = (report: SavedReport) => {
    setSelectedReport(report);
    setShowPdfModal(true);
    setTeamCalendarOpen(false);
  };

  const formatWeekEnding = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getWeekNumber = (dateStr: string) => {
    const date = new Date(dateStr);
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + startOfYear.getDay() + 1) / 7);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="glass-card border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Historical Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-pulse">Loading archived reports...</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Historical Account Reports */}
      <Card className="glass-card border-white/10">
        <CardHeader className="border-b border-white/5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Calendar className="h-5 w-5 text-primary" />
                Historical Account Reports
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Leadership summaries and account reports from previous weeks
              </p>
            </div>
            <div className="flex items-center gap-3">
              {accountReports.length > 0 && (
                <Popover open={accountCalendarOpen} onOpenChange={setAccountCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="gap-2"
                      data-testid="button-account-calendar-dropdown"
                    >
                      <CalendarDays className="h-4 w-4" />
                      Select Week
                      <ChevronDown className="h-4 w-4 ml-1" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <div className="p-3 border-b border-white/10">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        Browse Account Reports
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Select a week to view its account report
                      </p>
                    </div>
                    <ScrollArea className="h-[350px]">
                      <div className="p-2">
                        {accountSortedYears.map(year => (
                          <div key={year} className="mb-1">
                            <button
                              onClick={() => toggleAccountYear(year)}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover-elevate text-left font-medium"
                              data-testid={`account-calendar-year-${year}`}
                            >
                              {accountExpandedYears.has(year) ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <Calendar className="h-4 w-4 text-primary" />
                              {year}
                              <Badge variant="secondary" className="ml-auto text-xs">
                                {Object.values(accountGroupedReports[year]).flat().length}
                              </Badge>
                            </button>
                            
                            {accountExpandedYears.has(year) && (
                              <div className="ml-4 mt-1 space-y-1">
                                {MONTH_NAMES.filter(month => accountGroupedReports[year][month]).map(month => {
                                  const yearMonth = `${year}-${month}`;
                                  const monthReports = accountGroupedReports[year][month];
                                  
                                  return (
                                    <div key={yearMonth}>
                                      <button
                                        onClick={() => toggleAccountMonth(yearMonth)}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md hover-elevate text-left text-sm"
                                        data-testid={`account-calendar-month-${yearMonth}`}
                                      >
                                        {accountExpandedMonths.has(yearMonth) ? (
                                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                        ) : (
                                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                        )}
                                        {month}
                                        <Badge variant="outline" className="ml-auto text-xs">
                                          {monthReports.length}
                                        </Badge>
                                      </button>
                                      
                                      {accountExpandedMonths.has(yearMonth) && (
                                        <div className="ml-6 mt-1 space-y-1">
                                          {monthReports.map((report: SavedReport) => {
                                            const healthCounts = report.healthCounts as { onTrack?: number; needsAttention?: number; critical?: number } | null;
                                            
                                            return (
                                              <button
                                                key={report.id}
                                                onClick={() => handleAccountCalendarSelect(report)}
                                                className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover-elevate active-elevate-2 text-left text-sm bg-muted/30 border border-white/5"
                                                data-testid={`account-calendar-week-${report.id}`}
                                              >
                                                <div className="flex-1">
                                                  <div className="font-medium text-xs">
                                                    Week {getWeekNumber(report.weekEnd)}
                                                  </div>
                                                  <div className="text-xs text-muted-foreground">
                                                    Ending {formatWeekEnding(report.weekEnd)}
                                                  </div>
                                                </div>
                                                {healthCounts && (
                                                  <div className="flex items-center gap-1">
                                                    {(healthCounts.onTrack || 0) > 0 && (
                                                      <div className="h-2 w-2 rounded-full bg-success" title={`${healthCounts.onTrack} On Track`} />
                                                    )}
                                                    {(healthCounts.needsAttention || 0) > 0 && (
                                                      <div className="h-2 w-2 rounded-full bg-warning" title={`${healthCounts.needsAttention} Needs Attention`} />
                                                    )}
                                                    {(healthCounts.critical || 0) > 0 && (
                                                      <div className="h-2 w-2 rounded-full bg-destructive" title={`${healthCounts.critical} Critical`} />
                                                    )}
                                                  </div>
                                                )}
                                                <Eye className="h-3 w-3 text-muted-foreground" />
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              )}
              <Badge variant="outline" className="gap-1 bg-primary/10 text-primary border-primary/30">
                {accountReports.length} {accountReports.length === 1 ? 'Report' : 'Reports'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {accountReports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium mb-2">No account reports archived yet</p>
              <p className="text-sm max-w-md mx-auto">
                Archive weekly reports from the "View Current Report" tab to access them here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {accountReports.map((report) => {
                const healthCounts = report.healthCounts as { onTrack?: number; needsAttention?: number; critical?: number } | null;
                const { leadership: reportAiSummary } = parseSavedSummary(report.aiSummary, 'account');
                const healthConfig = reportAiSummary ? getOverallHealthConfig(reportAiSummary.overallHealth) : null;
                
                return (
                  <Card 
                    key={report.id} 
                    className="glass-card border-white/10 hover:border-primary/30 transition-all cursor-pointer group border-l-2 border-l-primary/50"
                    onClick={() => handleTileClick(report)}
                    data-testid={`historical-account-report-${report.id}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-primary" />
                          <div>
                            <h3 className="font-semibold text-lg">Week Ending {formatWeekEnding(report.weekEnd)}</h3>
                            <p className="text-xs text-muted-foreground">Started {formatWeekEnding(report.weekStart)}</p>
                          </div>
                        </div>
                        <Eye className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <Badge variant="secondary" className="gap-1">
                          <FileText className="h-3 w-3" />
                          {report.reportCount} Reports
                        </Badge>
                        {reportAiSummary && (
                          <Badge variant="outline" className="gap-1 border-primary/30">
                            <Sparkles className="h-3 w-3 text-primary" />
                            AI Summary
                          </Badge>
                        )}
                      </div>

                      {healthCounts && (
                        <div className="grid grid-cols-3 gap-2 mb-4">
                          <div className="text-center p-2 rounded-lg bg-success/10 border border-success/20">
                            <CheckCircle2 className="h-4 w-4 text-success mx-auto mb-1" />
                            <p className="text-lg font-bold text-success">{healthCounts.onTrack || 0}</p>
                            <p className="text-xs text-muted-foreground">On Track</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-warning/10 border border-warning/20">
                            <AlertTriangle className="h-4 w-4 text-warning mx-auto mb-1" />
                            <p className="text-lg font-bold text-warning">{healthCounts.needsAttention || 0}</p>
                            <p className="text-xs text-muted-foreground">Attention</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                            <AlertCircle className="h-4 w-4 text-destructive mx-auto mb-1" />
                            <p className="text-lg font-bold text-destructive">{healthCounts.critical || 0}</p>
                            <p className="text-xs text-muted-foreground">Critical</p>
                          </div>
                        </div>
                      )}

                      {reportAiSummary && healthConfig && (
                        <div className={`p-3 rounded-lg ${healthConfig.bgColor} border ${healthConfig.borderColor} mb-3`}>
                          <div className="flex items-center gap-2 mb-2">
                            <healthConfig.Icon className={`h-4 w-4 ${healthConfig.color}`} />
                            <span className={`text-sm font-medium ${healthConfig.color}`}>
                              Overall: {healthConfig.label}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-3">
                            {reportAiSummary.executiveSummary}
                          </p>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">
                        Saved: {new Date(report.savedAt).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Historical Team Feedback Reports - Only visible to Admin and Manager */}
      {permissions.canViewTeamFeedbackSummary && (
      <Card className="glass-card border-white/10">
        <CardHeader className="border-b border-white/5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Users className="h-5 w-5 text-blue-500" />
                Historical Team Feedback Reports
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Team feedback summaries and morale reports from previous weeks
              </p>
            </div>
            <div className="flex items-center gap-3">
              {teamReports.length > 0 && (
                <Popover open={teamCalendarOpen} onOpenChange={setTeamCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="gap-2"
                      data-testid="button-team-calendar-dropdown"
                    >
                      <CalendarDays className="h-4 w-4" />
                      Select Week
                      <ChevronDown className="h-4 w-4 ml-1" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <div className="p-3 border-b border-white/10">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-500" />
                        Browse Team Reports
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Select a week to view its team feedback report
                      </p>
                    </div>
                    <ScrollArea className="h-[350px]">
                      <div className="p-2">
                        {teamSortedYears.map(year => (
                          <div key={year} className="mb-1">
                            <button
                              onClick={() => toggleTeamYear(year)}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover-elevate text-left font-medium"
                              data-testid={`team-calendar-year-${year}`}
                            >
                              {teamExpandedYears.has(year) ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <Users className="h-4 w-4 text-blue-500" />
                              {year}
                              <Badge variant="secondary" className="ml-auto text-xs">
                                {Object.values(teamGroupedReports[year]).flat().length}
                              </Badge>
                            </button>
                            
                            {teamExpandedYears.has(year) && (
                              <div className="ml-4 mt-1 space-y-1">
                                {MONTH_NAMES.filter(month => teamGroupedReports[year][month]).map(month => {
                                  const yearMonth = `${year}-${month}`;
                                  const monthReports = teamGroupedReports[year][month];
                                  
                                  return (
                                    <div key={yearMonth}>
                                      <button
                                        onClick={() => toggleTeamMonth(yearMonth)}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md hover-elevate text-left text-sm"
                                        data-testid={`team-calendar-month-${yearMonth}`}
                                      >
                                        {teamExpandedMonths.has(yearMonth) ? (
                                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                        ) : (
                                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                        )}
                                        {month}
                                        <Badge variant="outline" className="ml-auto text-xs">
                                          {monthReports.length}
                                        </Badge>
                                      </button>
                                      
                                      {teamExpandedMonths.has(yearMonth) && (
                                        <div className="ml-6 mt-1 space-y-1">
                                          {monthReports.map((report: SavedReport) => {
                                            const { team: reportTeamSummary } = parseSavedSummary(report.aiSummary, 'team');
                                            
                                            return (
                                              <button
                                                key={report.id}
                                                onClick={() => handleTeamCalendarSelect(report)}
                                                className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover-elevate active-elevate-2 text-left text-sm bg-muted/30 border border-white/5"
                                                data-testid={`team-calendar-week-${report.id}`}
                                              >
                                                <div className="flex-1">
                                                  <div className="font-medium text-xs">
                                                    Week {getWeekNumber(report.weekEnd)}
                                                  </div>
                                                  <div className="text-xs text-muted-foreground">
                                                    Ending {formatWeekEnding(report.weekEnd)}
                                                  </div>
                                                </div>
                                                {reportTeamSummary && (
                                                  <div className={`h-2 w-2 rounded-full ${
                                                    reportTeamSummary.overallTeamMorale === 'positive' ? 'bg-success' :
                                                    reportTeamSummary.overallTeamMorale === 'mixed' ? 'bg-warning' : 'bg-destructive'
                                                  }`} title={`Morale: ${reportTeamSummary.overallTeamMorale}`} />
                                                )}
                                                <Eye className="h-3 w-3 text-muted-foreground" />
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              )}
              <Badge variant="outline" className="gap-1 bg-blue-500/10 text-blue-400 border-blue-500/30">
                {teamReports.length} {teamReports.length === 1 ? 'Report' : 'Reports'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {teamReports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium mb-2">No team feedback reports archived yet</p>
              <p className="text-sm max-w-md mx-auto">
                Archive weekly reports from the "View Current Report" tab to access them here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {teamReports.map((report) => {
                const { team: reportTeamSummary } = parseSavedSummary(report.aiSummary, 'team');
                
                return (
                  <Card 
                    key={report.id} 
                    className="glass-card border-white/10 hover:border-blue-500/30 transition-all cursor-pointer group border-l-2 border-l-blue-500/50"
                    onClick={() => handleTileClick(report)}
                    data-testid={`historical-team-report-${report.id}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-blue-500" />
                          <div>
                            <h3 className="font-semibold text-lg">Week Ending {formatWeekEnding(report.weekEnd)}</h3>
                            <p className="text-xs text-muted-foreground">Started {formatWeekEnding(report.weekStart)}</p>
                          </div>
                        </div>
                        <Eye className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <Badge variant="secondary" className="gap-1">
                          <FileText className="h-3 w-3" />
                          {report.reportCount} Feedbacks
                        </Badge>
                        {reportTeamSummary && (
                          <Badge variant="outline" className="gap-1 border-blue-500/30">
                            <Sparkles className="h-3 w-3 text-blue-500" />
                            AI Summary
                          </Badge>
                        )}
                      </div>

                      {reportTeamSummary && (
                        <div className={`p-3 rounded-lg ${
                          reportTeamSummary.overallTeamMorale === 'positive' ? 'bg-success/10 border border-success/30' :
                          reportTeamSummary.overallTeamMorale === 'mixed' ? 'bg-warning/10 border border-warning/30' :
                          'bg-destructive/10 border border-destructive/30'
                        } mb-3`}>
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="h-4 w-4 text-blue-400" />
                            <span className={`text-sm font-medium ${
                              reportTeamSummary.overallTeamMorale === 'positive' ? 'text-success' :
                              reportTeamSummary.overallTeamMorale === 'mixed' ? 'text-warning' : 'text-destructive'
                            }`}>
                              Team Morale: {reportTeamSummary.overallTeamMorale === 'positive' ? 'Positive' : 
                                           reportTeamSummary.overallTeamMorale === 'mixed' ? 'Mixed' : 'Concerning'}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-3">
                            {reportTeamSummary.teamSummary}
                          </p>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">
                        Saved: {new Date(report.savedAt).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      <Dialog open={showPdfModal} onOpenChange={setShowPdfModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FileText className="h-5 w-5 text-primary" />
              Weekly Report Preview
            </DialogTitle>
            {selectedReport && (
              <DialogDescription>
                Week Ending {formatWeekEnding(selectedReport.weekEnd)}
              </DialogDescription>
            )}
          </DialogHeader>
          
          {selectedReport && (() => {
            const healthCounts = selectedReport.healthCounts as { onTrack?: number; needsAttention?: number; critical?: number } | null;
            const selectedReportType = (selectedReport as any).reportType || 'account';
            const isSelectedTeamReport = selectedReportType === 'team';
            const { leadership: reportAiSummary, team: reportTeamSummary } = parseSavedSummary(selectedReport.aiSummary, selectedReportType);
            const healthConfig = reportAiSummary ? getOverallHealthConfig(reportAiSummary.overallHealth) : null;

            return (
              <>
                <div className="flex items-center justify-between gap-4 py-4 border-b border-white/10">
                  <div className="flex items-center gap-4">
                    <Badge variant={isSelectedTeamReport ? 'secondary' : 'default'} className={`gap-1 ${isSelectedTeamReport ? 'bg-blue-500/20 text-blue-400' : 'bg-primary/20 text-primary'}`}>
                      {isSelectedTeamReport ? <Users className="h-3 w-3" /> : <BarChart3 className="h-3 w-3" />}
                      {selectedReport.reportCount} {isSelectedTeamReport ? 'Feedbacks' : 'Reports'}
                    </Badge>
                    <Badge variant="outline" className={isSelectedTeamReport ? 'border-blue-500/30 text-blue-400' : 'border-primary/30 text-primary'}>
                      {isSelectedTeamReport ? 'Team Report' : 'Account Report'}
                    </Badge>
                    {!isSelectedTeamReport && healthCounts && (
                      <div className="flex items-center gap-3 text-sm">
                        <span className="flex items-center gap-1">
                          <div className="h-2 w-2 rounded-full bg-success" />
                          <span className="text-success font-medium">{healthCounts.onTrack || 0}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="h-2 w-2 rounded-full bg-warning" />
                          <span className="text-warning font-medium">{healthCounts.needsAttention || 0}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="h-2 w-2 rounded-full bg-destructive" />
                          <span className="text-destructive font-medium">{healthCounts.critical || 0}</span>
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedReport.pdfData && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => downloadPDF(selectedReport)}
                        data-testid="button-download-pdf-modal"
                      >
                        <Sparkles className="h-4 w-4" />
                        {isSelectedTeamReport ? 'Team Summary (PDF)' : 'Leadership Summary (PDF)'}
                      </Button>
                    )}
                    {selectedReport.csvData && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => downloadCSV(selectedReport)}
                        data-testid="button-download-csv-modal"
                      >
                        <FileDown className="h-4 w-4" />
                        {isSelectedTeamReport ? 'Team Feedback (CSV)' : 'Account Reports (CSV)'}
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-2"
                          data-testid="button-delete-historical"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Archived Report?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the archived report for week ending {formatWeekEnding(selectedReport.weekEnd)}. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteArchivedReportMutation.mutate(selectedReport.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {!isSelectedTeamReport && !reportAiSummary && permissions.canGenerateAISummary && (
                  <div className="p-4 rounded-lg bg-muted/20 border border-muted/30 my-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        <span className="text-sm text-muted-foreground">No AI summary available for this archived report</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => regenerateAISummaryMutation.mutate(selectedReport.id)}
                        disabled={regenerateAISummaryMutation.isPending}
                        data-testid="button-regenerate-ai-summary"
                      >
                        {regenerateAISummaryMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        {regenerateAISummaryMutation.isPending ? 'Generating...' : 'Regenerate AI Summary'}
                      </Button>
                    </div>
                  </div>
                )}

                {reportAiSummary && healthConfig && (
                  <div className={`p-4 rounded-lg ${healthConfig.bgColor} border ${healthConfig.borderColor} my-4`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold">Leadership Summary</h4>
                      <Badge className={`ml-auto ${healthConfig.bgColor} ${healthConfig.color} border-0`}>
                        <healthConfig.Icon className="h-3 w-3 mr-1" />
                        {healthConfig.label}
                      </Badge>
                    </div>
                    <p className="text-sm mb-4">{reportAiSummary.executiveSummary}</p>
                    
                    {/* Portfolio Health Breakdown (matching ViewReports format) */}
                    {reportAiSummary.portfolioHealthBreakdown && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="p-4 rounded-lg bg-success/10 border border-success/30">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="h-4 w-4 text-success" />
                            <h4 className="font-medium text-success">On Track ({reportAiSummary.portfolioHealthBreakdown.onTrack.count})</h4>
                          </div>
                          <ul className="space-y-1 max-h-32 overflow-y-auto scrollbar-visible pr-2">
                            {reportAiSummary.portfolioHealthBreakdown.onTrack.projects.map((project, i) => (
                              <li key={i} className="text-xs text-muted-foreground">{project}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-warning" />
                            <h4 className="font-medium text-warning">Needs Attention ({reportAiSummary.portfolioHealthBreakdown.needsAttention.count})</h4>
                          </div>
                          <ul className="space-y-1 max-h-32 overflow-y-auto scrollbar-visible pr-2">
                            {reportAiSummary.portfolioHealthBreakdown.needsAttention.projects.map((project, i) => (
                              <li key={i} className="text-xs text-muted-foreground">{project}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="h-4 w-4 text-destructive" />
                            <h4 className="font-medium text-destructive">Critical ({reportAiSummary.portfolioHealthBreakdown.critical.count})</h4>
                          </div>
                          <ul className="space-y-1 max-h-32 overflow-y-auto scrollbar-visible pr-2">
                            {reportAiSummary.portfolioHealthBreakdown.critical.projects.map((project, i) => (
                              <li key={i} className="text-xs text-muted-foreground">{project}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Immediate Attention Required (new comprehensive format) */}
                    {reportAiSummary.immediateAttentionRequired && reportAiSummary.immediateAttentionRequired.length > 0 && (
                      <div className="mb-4 p-3 rounded bg-destructive/5 border border-destructive/20">
                        <p className="text-xs font-medium text-destructive mb-2">Immediate Attention Required</p>
                        <div className="space-y-2">
                          {reportAiSummary.immediateAttentionRequired.map((item, i) => (
                            <div key={i} className="text-xs text-muted-foreground">
                              <span className="font-medium">{item.project}</span> ({item.lead}): {item.issue}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {reportAiSummary.weekHighlights && reportAiSummary.weekHighlights.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-primary mb-2">Weekly Highlights</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {reportAiSummary.weekHighlights.map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {reportAiSummary.keyAchievements && reportAiSummary.keyAchievements.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-success mb-2">Key Achievements</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {reportAiSummary.keyAchievements.map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-success mt-1.5 shrink-0" />
                                {typeof item === 'string' ? item : `${item.project}: ${item.achievement}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {reportAiSummary.attentionNeeded && reportAiSummary.attentionNeeded.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-warning mb-2">Needs Attention</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {reportAiSummary.attentionNeeded.map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-warning mt-1.5 shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {reportAiSummary.upcomingFocus && reportAiSummary.upcomingFocus.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-blue-400 mb-2">Upcoming Focus</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {reportAiSummary.upcomingFocus.map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                                {typeof item === 'string' ? item : `${item.project} (${item.priority}): ${item.focus}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {reportAiSummary.criticalIssues && reportAiSummary.criticalIssues.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-destructive mb-2">Critical Issues</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {reportAiSummary.criticalIssues.map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Cross-Project Patterns (new comprehensive format) */}
                      {reportAiSummary.crossProjectPatterns && (
                        <>
                          {reportAiSummary.crossProjectPatterns.commonChallenges?.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-warning mb-2">Common Challenges</p>
                              <ul className="text-xs text-muted-foreground space-y-1">
                                {reportAiSummary.crossProjectPatterns.commonChallenges.map((item, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-warning mt-1.5 shrink-0" />
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {reportAiSummary.crossProjectPatterns.resourceConstraints?.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-blue-400 mb-2">Resource Constraints</p>
                              <ul className="text-xs text-muted-foreground space-y-1">
                                {reportAiSummary.crossProjectPatterns.resourceConstraints.map((item, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}

                      {/* Week-over-Week Changes */}
                      {reportAiSummary.weekOverWeekChanges && (
                        <div className="col-span-2">
                          <p className="text-xs font-medium text-primary mb-2">Week-over-Week Changes</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {reportAiSummary.weekOverWeekChanges.improved?.length > 0 && (
                              <div>
                                <p className="text-[10px] font-medium text-success mb-1">Improved</p>
                                <ul className="text-xs text-muted-foreground space-y-0.5">
                                  {reportAiSummary.weekOverWeekChanges.improved.slice(0, 3).map((item: string, i: number) => (
                                    <li key={i} className="flex items-start gap-1">
                                      <div className="h-1 w-1 rounded-full bg-success mt-1.5 shrink-0" />
                                      <span className="text-[10px]">{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {reportAiSummary.weekOverWeekChanges.worsened?.length > 0 && (
                              <div>
                                <p className="text-[10px] font-medium text-destructive mb-1">Worsened</p>
                                <ul className="text-xs text-muted-foreground space-y-0.5">
                                  {reportAiSummary.weekOverWeekChanges.worsened.slice(0, 3).map((item: string, i: number) => (
                                    <li key={i} className="flex items-start gap-1">
                                      <div className="h-1 w-1 rounded-full bg-destructive mt-1.5 shrink-0" />
                                      <span className="text-[10px]">{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {reportAiSummary.weekOverWeekChanges.newRisks?.length > 0 && (
                              <div>
                                <p className="text-[10px] font-medium text-warning mb-1">New Risks</p>
                                <ul className="text-xs text-muted-foreground space-y-0.5">
                                  {reportAiSummary.weekOverWeekChanges.newRisks.slice(0, 3).map((item: string, i: number) => (
                                    <li key={i} className="flex items-start gap-1">
                                      <div className="h-1 w-1 rounded-full bg-warning mt-1.5 shrink-0" />
                                      <span className="text-[10px]">{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {reportAiSummary.weekOverWeekChanges.resolved?.length > 0 && (
                              <div>
                                <p className="text-[10px] font-medium text-blue-400 mb-1">Resolved</p>
                                <ul className="text-xs text-muted-foreground space-y-0.5">
                                  {reportAiSummary.weekOverWeekChanges.resolved.slice(0, 3).map((item: string, i: number) => (
                                    <li key={i} className="flex items-start gap-1">
                                      <div className="h-1 w-1 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                                      <span className="text-[10px]">{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Dependencies & Cross-Team Needs */}
                      {reportAiSummary.dependenciesAndCrossTeamNeeds && reportAiSummary.dependenciesAndCrossTeamNeeds.length > 0 && (
                        <div className="col-span-2">
                          <p className="text-xs font-medium text-purple-400 mb-2">Dependencies & Cross-Team Needs</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {reportAiSummary.dependenciesAndCrossTeamNeeds.slice(0, 5).map((dep: any, i: number) => (
                              <li key={i} className="flex items-start gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                                <span><strong>{dep.project}:</strong> {dep.dependency} <span className="text-muted-foreground/70">(Impact: {dep.impact})</span></span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Recommended Leadership Actions (new comprehensive format) */}
                      {reportAiSummary.recommendedLeadershipActions && reportAiSummary.recommendedLeadershipActions.length > 0 && (
                        <div className="col-span-2">
                          <p className="text-xs font-medium text-primary mb-2">Recommended Actions</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {reportAiSummary.recommendedLeadershipActions.map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <Badge variant={item.priority === 'high' ? 'destructive' : 'default'} className="text-[10px] px-1 py-0 shrink-0">
                                  {item.priority}
                                </Badge>
                                <span>{item.action}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Team Member Summary Section */}
                {isSelectedTeamReport && !reportTeamSummary && permissions.canGenerateAISummary && (
                  <div className="p-4 rounded-lg bg-muted/20 border border-muted/30 my-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        <span className="text-sm text-muted-foreground">No AI summary available for this archived team report</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => regenerateAISummaryMutation.mutate(selectedReport.id)}
                        disabled={regenerateAISummaryMutation.isPending}
                        data-testid="button-regenerate-team-ai-summary"
                      >
                        {regenerateAISummaryMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        {regenerateAISummaryMutation.isPending ? 'Generating...' : 'Regenerate AI Summary'}
                      </Button>
                    </div>
                  </div>
                )}

                {reportTeamSummary && (
                  <div className={`p-4 rounded-lg ${
                    reportTeamSummary.overallTeamMorale === 'positive' ? 'bg-success/10 border border-success/30' :
                    reportTeamSummary.overallTeamMorale === 'mixed' ? 'bg-warning/10 border border-warning/30' :
                    'bg-destructive/10 border border-destructive/30'
                  } mb-4`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="h-4 w-4 text-blue-500" />
                      <h4 className="font-semibold">Team Members Summary</h4>
                      <Badge className={`ml-auto ${
                        reportTeamSummary.overallTeamMorale === 'positive' ? 'bg-success/10 text-success' :
                        reportTeamSummary.overallTeamMorale === 'mixed' ? 'bg-warning/10 text-warning' :
                        'bg-destructive/10 text-destructive'
                      } border-0`}>
                        {reportTeamSummary.overallTeamMorale === 'positive' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {reportTeamSummary.overallTeamMorale === 'mixed' && <AlertTriangle className="h-3 w-3 mr-1" />}
                        {reportTeamSummary.overallTeamMorale === 'concerning' && <AlertCircle className="h-3 w-3 mr-1" />}
                        Morale: {reportTeamSummary.overallTeamMorale === 'positive' ? 'Positive' : 
                                 reportTeamSummary.overallTeamMorale === 'mixed' ? 'Mixed' : 'Concerning'}
                      </Badge>
                    </div>
                    <p className="text-sm mb-4">{reportTeamSummary.teamSummary}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {reportTeamSummary.teamHighlights && reportTeamSummary.teamHighlights.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-blue-400 mb-2">Team Highlights</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {reportTeamSummary.teamHighlights.map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                                {typeof item === 'string' ? item : `${item.memberName} (${item.project}): ${item.highlight}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {reportTeamSummary.recognitionOpportunities && reportTeamSummary.recognitionOpportunities.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-success mb-2">Recognition Opportunities</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {reportTeamSummary.recognitionOpportunities.map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-success mt-1.5 shrink-0" />
                                {typeof item === 'string' ? item : `${item.memberName}: ${item.achievement}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {reportTeamSummary.teamConcerns && reportTeamSummary.teamConcerns.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-warning mb-2">Team Concerns</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {reportTeamSummary.teamConcerns.map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-warning mt-1.5 shrink-0" />
                                {typeof item === 'string' ? item : `${item.concern} (${item.project})`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {reportTeamSummary.supportNeeded && reportTeamSummary.supportNeeded.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-destructive mb-2">Support Needed</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {reportTeamSummary.supportNeeded.map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                                {typeof item === 'string' ? item : `${item.area}: ${item.suggestedSupport}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Workload Observations (new comprehensive format) */}
                      {reportTeamSummary.workloadObservations && reportTeamSummary.workloadObservations.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-blue-400 mb-2">Workload Observations</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {reportTeamSummary.workloadObservations.map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                                {item.observation}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Development Opportunities (new comprehensive format) */}
                      {reportTeamSummary.developmentOpportunities && reportTeamSummary.developmentOpportunities.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-purple-400 mb-2">Development Opportunities</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {reportTeamSummary.developmentOpportunities.map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                                {item.memberName}: {item.opportunity}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Retention Risks (new comprehensive format) */}
                      {reportTeamSummary.retentionRisks && reportTeamSummary.retentionRisks.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-destructive mb-2">Retention Risks</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {reportTeamSummary.retentionRisks.map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                                {item.indicator}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Recommended HR Actions (new comprehensive format) */}
                      {reportTeamSummary.recommendedHRActions && reportTeamSummary.recommendedHRActions.length > 0 && (
                        <div className="col-span-2">
                          <p className="text-xs font-medium text-primary mb-2">Recommended HR Actions</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {reportTeamSummary.recommendedHRActions.map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <Badge variant={item.priority === 'high' ? 'destructive' : 'default'} className="text-[10px] px-1 py-0 shrink-0">
                                  {item.priority}
                                </Badge>
                                <span>{item.action}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
