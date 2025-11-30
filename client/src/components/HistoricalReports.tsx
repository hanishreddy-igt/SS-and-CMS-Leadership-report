import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
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
  Download,
  Trash2,
  Eye,
  BarChart3,
  ChevronDown,
  ChevronRight,
  CalendarDays
} from 'lucide-react';
import type { SavedReport } from '@shared/schema';

interface AISummary {
  overallHealth: 'on-track' | 'needs-attention' | 'critical';
  weekHighlights: string[];
  keyAchievements: string[];
  criticalIssues: string[];
  attentionNeeded: string[];
  upcomingFocus: string[];
  executiveSummary: string;
}

interface GroupedReports {
  [year: string]: {
    [month: string]: SavedReport[];
  };
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
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  const { data: savedReports = [], isLoading } = useQuery<SavedReport[]>({ 
    queryKey: ['/api/saved-reports'] 
  });

  // Create blob URL for PDF preview when a report is selected
  useEffect(() => {
    if (selectedReport?.pdfData && showPdfModal) {
      try {
        const byteCharacters = atob(selectedReport.pdfData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfBlobUrl(url);
        
        // Cleanup on unmount or when report changes
        return () => {
          URL.revokeObjectURL(url);
          setPdfBlobUrl(null);
        };
      } catch (error) {
        console.error('Error creating PDF blob:', error);
        setPdfBlobUrl(null);
      }
    } else {
      setPdfBlobUrl(null);
    }
  }, [selectedReport, showPdfModal]);

  // Group reports by year and month based on weekEnd date
  const groupedReports = useMemo(() => {
    const grouped: GroupedReports = {};
    
    savedReports.forEach(report => {
      const endDate = new Date(report.weekEnd);
      const year = endDate.getFullYear().toString();
      const month = MONTH_NAMES[endDate.getMonth()];
      
      if (!grouped[year]) {
        grouped[year] = {};
      }
      if (!grouped[year][month]) {
        grouped[year][month] = [];
      }
      grouped[year][month].push(report);
    });

    // Sort reports within each month by weekEnd date (most recent first)
    Object.keys(grouped).forEach(year => {
      Object.keys(grouped[year]).forEach(month => {
        grouped[year][month].sort((a, b) => 
          new Date(b.weekEnd).getTime() - new Date(a.weekEnd).getTime()
        );
      });
    });

    return grouped;
  }, [savedReports]);

  // Get sorted years (most recent first)
  const sortedYears = useMemo(() => {
    return Object.keys(groupedReports).sort((a, b) => parseInt(b) - parseInt(a));
  }, [groupedReports]);

  // Auto-expand the most recent year when data loads
  useMemo(() => {
    if (sortedYears.length > 0 && expandedYears.size === 0) {
      setExpandedYears(new Set([sortedYears[0]]));
    }
  }, [sortedYears]);

  const toggleYear = (year: string) => {
    const newExpanded = new Set(expandedYears);
    if (newExpanded.has(year)) {
      newExpanded.delete(year);
    } else {
      newExpanded.add(year);
    }
    setExpandedYears(newExpanded);
  };

  const toggleMonth = (yearMonth: string) => {
    const newExpanded = new Set(expandedMonths);
    if (newExpanded.has(yearMonth)) {
      newExpanded.delete(yearMonth);
    } else {
      newExpanded.add(yearMonth);
    }
    setExpandedMonths(newExpanded);
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

  const downloadPDF = (report: SavedReport) => {
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${report.pdfData}`;
    link.download = `weekly_report_ending_${report.weekEnd}.pdf`;
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
    const blob = new Blob([report.csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `weekly_report_ending_${report.weekEnd}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleTileClick = (report: SavedReport) => {
    setSelectedReport(report);
    setShowPdfModal(true);
  };

  const handleCalendarSelect = (report: SavedReport) => {
    setSelectedReport(report);
    setShowPdfModal(true);
    setCalendarOpen(false);
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
      <Card className="glass-card border-white/10">
        <CardHeader className="border-b border-white/5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <History className="h-5 w-5 text-primary" />
                Historical Reports
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                View and download previously archived weekly reports
              </p>
            </div>
            <div className="flex items-center gap-3">
              {savedReports.length > 0 && (
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="gap-2"
                      data-testid="button-calendar-dropdown"
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
                        Browse by Week Ending
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Select a week to view its report
                      </p>
                    </div>
                    <ScrollArea className="h-[350px]">
                      <div className="p-2">
                        {sortedYears.map(year => (
                          <div key={year} className="mb-1">
                            <button
                              onClick={() => toggleYear(year)}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover-elevate text-left font-medium"
                              data-testid={`calendar-year-${year}`}
                            >
                              {expandedYears.has(year) ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <Calendar className="h-4 w-4 text-primary" />
                              {year}
                              <Badge variant="secondary" className="ml-auto text-xs">
                                {Object.values(groupedReports[year]).flat().length}
                              </Badge>
                            </button>
                            
                            {expandedYears.has(year) && (
                              <div className="ml-4 mt-1 space-y-1">
                                {MONTH_NAMES.filter(month => groupedReports[year][month]).map(month => {
                                  const yearMonth = `${year}-${month}`;
                                  const monthReports = groupedReports[year][month];
                                  
                                  return (
                                    <div key={yearMonth}>
                                      <button
                                        onClick={() => toggleMonth(yearMonth)}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md hover-elevate text-left text-sm"
                                        data-testid={`calendar-month-${yearMonth}`}
                                      >
                                        {expandedMonths.has(yearMonth) ? (
                                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                        ) : (
                                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                        )}
                                        {month}
                                        <Badge variant="outline" className="ml-auto text-xs">
                                          {monthReports.length}
                                        </Badge>
                                      </button>
                                      
                                      {expandedMonths.has(yearMonth) && (
                                        <div className="ml-6 mt-1 space-y-1">
                                          {monthReports.map(report => {
                                            const healthCounts = report.healthCounts as { onTrack?: number; needsAttention?: number; critical?: number } | null;
                                            
                                            return (
                                              <button
                                                key={report.id}
                                                onClick={() => handleCalendarSelect(report)}
                                                className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover-elevate active-elevate-2 text-left text-sm bg-muted/30 border border-white/5"
                                                data-testid={`calendar-week-${report.id}`}
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
              <Badge variant="outline" className="gap-1">
                {savedReports.length} {savedReports.length === 1 ? 'Report' : 'Reports'} Archived
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {savedReports.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <History className="h-20 w-20 mx-auto mb-6 opacity-20" />
              <p className="text-xl font-medium mb-2">No archived reports yet</p>
              <p className="text-sm max-w-md mx-auto">
                Archive weekly reports from the "View Current Report" tab to access them here for future reference.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {savedReports.map((report) => {
                const healthCounts = report.healthCounts as { onTrack?: number; needsAttention?: number; critical?: number } | null;
                const reportAiSummary = report.aiSummary as AISummary | null;
                const healthConfig = reportAiSummary ? getOverallHealthConfig(reportAiSummary.overallHealth) : null;
                
                return (
                  <Card 
                    key={report.id} 
                    className="glass-card border-white/10 hover:border-primary/30 transition-all cursor-pointer group"
                    onClick={() => handleTileClick(report)}
                    data-testid={`historical-report-${report.id}`}
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
                      
                      <div className="flex items-center gap-2 mb-4">
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

      <Dialog open={showPdfModal} onOpenChange={setShowPdfModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
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
            const reportAiSummary = selectedReport.aiSummary as AISummary | null;
            const healthConfig = reportAiSummary ? getOverallHealthConfig(reportAiSummary.overallHealth) : null;

            return (
              <>
                <div className="flex items-center justify-between gap-4 py-4 border-b border-white/10">
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary" className="gap-1">
                      <BarChart3 className="h-3 w-3" />
                      {selectedReport.reportCount} Reports
                    </Badge>
                    {healthCounts && (
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
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => downloadPDF(selectedReport)}
                      data-testid="button-download-pdf-modal"
                    >
                      <Download className="h-4 w-4" />
                      Download PDF
                    </Button>
                    {selectedReport.csvData && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => downloadCSV(selectedReport)}
                        data-testid="button-download-csv-modal"
                      >
                        <FileDown className="h-4 w-4" />
                        Download CSV
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

                {reportAiSummary && healthConfig && (
                  <div className={`p-4 rounded-lg ${healthConfig.bgColor} border ${healthConfig.borderColor} my-4`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold">AI Summary</h4>
                      <Badge className={`ml-auto ${healthConfig.bgColor} ${healthConfig.color} border-0`}>
                        <healthConfig.Icon className="h-3 w-3 mr-1" />
                        {healthConfig.label}
                      </Badge>
                    </div>
                    <p className="text-sm mb-4">{reportAiSummary.executiveSummary}</p>
                    
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
                                {item}
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
                                {item}
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
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-hidden rounded-lg border border-white/10 bg-white">
                  {pdfBlobUrl ? (
                    <iframe
                      src={pdfBlobUrl}
                      className="w-full h-full min-h-[500px]"
                      title="PDF Preview"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-[500px] text-muted-foreground">
                      <div className="text-center">
                        <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>Loading PDF preview...</p>
                        <p className="text-sm mt-2">Use the Download PDF button above to view the full report.</p>
                      </div>
                    </div>
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
