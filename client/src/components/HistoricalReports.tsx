import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
  BarChart3
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

export default function HistoricalReports() {
  const { toast } = useToast();
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);

  const { data: savedReports = [], isLoading } = useQuery<SavedReport[]>({ 
    queryKey: ['/api/saved-reports'] 
  });

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
    link.download = `weekly_report_${report.weekStart}_to_${report.weekEnd}.pdf`;
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
    link.setAttribute('download', `weekly_report_${report.weekStart}_to_${report.weekEnd}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleTileClick = (report: SavedReport) => {
    setSelectedReport(report);
    setShowPdfModal(true);
  };

  const closePdfModal = () => {
    setShowPdfModal(false);
    setSelectedReport(null);
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
            <Badge variant="outline" className="gap-1">
              {savedReports.length} {savedReports.length === 1 ? 'Report' : 'Reports'} Archived
            </Badge>
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
                            <h3 className="font-semibold text-lg">Week of {report.weekStart}</h3>
                            <p className="text-xs text-muted-foreground">to {report.weekEnd}</p>
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
                Week of {selectedReport.weekStart} to {selectedReport.weekEnd}
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
                            This will permanently delete the archived report for week {selectedReport.weekStart} to {selectedReport.weekEnd}. This action cannot be undone.
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
                  <iframe
                    src={`data:application/pdf;base64,${selectedReport.pdfData}`}
                    className="w-full h-full min-h-[500px]"
                    title="PDF Preview"
                  />
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
