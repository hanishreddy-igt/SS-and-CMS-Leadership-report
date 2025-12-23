import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, RefreshCw, CheckCircle2, AlertTriangle, AlertCircle, Target, TrendingUp, Lightbulb, Loader2, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import type { WeeklyReport } from '@shared/schema';

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
  criticalIssues?: string[];
  attentionNeeded?: string[];
}

const getOverallHealthConfig = (health: string) => {
  switch (health) {
    case 'on-track':
      return { label: 'On Track', icon: CheckCircle2, color: 'text-success', bgColor: 'bg-success/10', borderColor: 'border-success/30' };
    case 'needs-attention':
      return { label: 'Needs Attention', icon: AlertTriangle, color: 'text-warning', bgColor: 'bg-warning/10', borderColor: 'border-warning/30' };
    case 'critical':
      return { label: 'Critical', icon: AlertCircle, color: 'text-destructive', bgColor: 'bg-destructive/10', borderColor: 'border-destructive/30' };
    default:
      return { label: 'Unknown', icon: AlertCircle, color: 'text-muted-foreground', bgColor: 'bg-muted/10', borderColor: 'border-white/10' };
  }
};

export default function LeadershipSummary() {
  const { toast } = useToast();
  const permissions = usePermissions();
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [reportsAnalyzed, setReportsAnalyzed] = useState(0);

  const { data: weeklyReports = [] } = useQuery<WeeklyReport[]>({ queryKey: ['/api/weekly-reports'] });
  const { data: reportingWeek } = useQuery<{ weekStart: string; weekEnd: string }>({
    queryKey: ['/api/reporting-week'],
  });

  const submittedReports = weeklyReports.filter(r => r.status === 'submitted');

  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/generate-summary');
      return res.json();
    },
    onSuccess: (data) => {
      if (data.summary) {
        setAiSummary(data.summary);
        setReportsAnalyzed(data.reportsAnalyzed || 0);
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
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to generate AI summary',
        variant: 'destructive',
      });
    },
  });

  const downloadPDF = () => {
    if (!aiSummary) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let y = 20;
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Leadership AI Summary', pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Week: ${reportingWeek?.weekStart} to ${reportingWeek?.weekEnd}`, pageWidth / 2, y, { align: 'center' });
    y += 15;
    
    const healthConfig = getOverallHealthConfig(aiSummary.overallHealth);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Overall Health: ${healthConfig.label}`, 20, y);
    y += 10;
    
    doc.setFontSize(11);
    doc.text('Executive Summary', 20, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const summaryLines = doc.splitTextToSize(aiSummary.executiveSummary, pageWidth - 40);
    doc.text(summaryLines, 20, y);
    y += summaryLines.length * 5 + 10;
    
    if (aiSummary.immediateAttentionRequired?.length) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Immediate Attention Required', 20, y);
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      aiSummary.immediateAttentionRequired.forEach((item) => {
        const text = `${item.project}: ${item.issue}`;
        const lines = doc.splitTextToSize(text, pageWidth - 45);
        doc.text(lines, 25, y);
        y += lines.length * 4 + 3;
      });
      y += 5;
    }
    
    if (aiSummary.recommendedLeadershipActions?.length) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Recommended Actions', 20, y);
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      aiSummary.recommendedLeadershipActions.forEach((item) => {
        const text = `[${item.priority.toUpperCase()}] ${item.action}`;
        const lines = doc.splitTextToSize(text, pageWidth - 45);
        doc.text(lines, 25, y);
        y += lines.length * 4 + 3;
      });
    }
    
    doc.save(`leadership_summary_${reportingWeek?.weekEnd || 'report'}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Leadership AI Summary
          </h2>
          <p className="text-muted-foreground mt-1">
            AI-powered insights from {submittedReports.length} submitted reports
          </p>
        </div>
        <div className="flex gap-2">
          {aiSummary && (
            <Button variant="outline" size="sm" onClick={downloadPDF} className="gap-2" data-testid="button-download-summary">
              <FileDown className="h-4 w-4" />
              Download PDF
            </Button>
          )}
          {permissions.canGenerateAISummary && (
            <Button 
              onClick={() => generateSummaryMutation.mutate()} 
              disabled={generateSummaryMutation.isPending}
              className="gap-2"
              data-testid="button-generate-summary"
            >
              {generateSummaryMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {aiSummary ? 'Regenerate' : 'Generate'} Summary
            </Button>
          )}
        </div>
      </div>

      {!aiSummary ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Summary Generated</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Generate an AI-powered summary to get insights from all submitted weekly reports.
            </p>
            {permissions.canGenerateAISummary && (
              <Button 
                onClick={() => generateSummaryMutation.mutate()} 
                disabled={generateSummaryMutation.isPending}
                className="gap-2"
              >
                {generateSummaryMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generate Summary
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className={`${getOverallHealthConfig(aiSummary.overallHealth).bgColor} border ${getOverallHealthConfig(aiSummary.overallHealth).borderColor}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {(() => {
                  const config = getOverallHealthConfig(aiSummary.overallHealth);
                  const Icon = config.icon;
                  return <Icon className={`h-5 w-5 ${config.color}`} />;
                })()}
                Overall Portfolio Health: {getOverallHealthConfig(aiSummary.overallHealth).label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{aiSummary.executiveSummary}</p>
              <p className="text-xs text-muted-foreground mt-2">Based on {reportsAnalyzed} reports</p>
            </CardContent>
          </Card>

          {aiSummary.portfolioHealthBreakdown && (
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-success/5 border-success/20">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="font-semibold text-success">{aiSummary.portfolioHealthBreakdown.onTrack.count} On Track</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {aiSummary.portfolioHealthBreakdown.onTrack.projects.map((p, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{p}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-warning/5 border-warning/20">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    <span className="font-semibold text-warning">{aiSummary.portfolioHealthBreakdown.needsAttention.count} Needs Attention</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {aiSummary.portfolioHealthBreakdown.needsAttention.projects.map((p, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{p}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-destructive/5 border-destructive/20">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <span className="font-semibold text-destructive">{aiSummary.portfolioHealthBreakdown.critical.count} Critical</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {aiSummary.portfolioHealthBreakdown.critical.projects.map((p, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{p}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {aiSummary.immediateAttentionRequired && aiSummary.immediateAttentionRequired.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  Immediate Attention Required
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-4">
                    {aiSummary.immediateAttentionRequired.map((item, i) => (
                      <div key={i} className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold">{item.project}</span>
                          <Badge variant="outline" className="text-xs">{item.lead}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{item.issue}</p>
                        <div className="text-xs text-primary flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          {item.recommendedAction}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {aiSummary.keyAchievements && aiSummary.keyAchievements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-success">
                  <TrendingUp className="h-5 w-5" />
                  Key Achievements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {aiSummary.keyAchievements.map((item, i) => (
                    <div key={i} className="p-3 rounded-lg bg-success/5 border border-success/20">
                      {typeof item === 'string' ? (
                        <p className="text-sm">{item}</p>
                      ) : (
                        <>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-sm">{item.project}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{item.achievement}</p>
                          {item.impact && <p className="text-xs text-success mt-1">{item.impact}</p>}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {aiSummary.recommendedLeadershipActions && aiSummary.recommendedLeadershipActions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Lightbulb className="h-5 w-5" />
                  Recommended Leadership Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {aiSummary.recommendedLeadershipActions.map((item, i) => (
                    <div key={i} className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={item.priority === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                          {item.priority.toUpperCase()}
                        </Badge>
                        <span className="font-medium text-sm">{item.action}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{item.rationale}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
