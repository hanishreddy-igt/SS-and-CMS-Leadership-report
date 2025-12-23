import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, RefreshCw, Heart, AlertTriangle, TrendingUp, Lightbulb, Loader2, FileDown, ThumbsUp, Award } from 'lucide-react';
import jsPDF from 'jspdf';
import type { FeedbackEntry, Person } from '@shared/schema';

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
  teamHighlights?: TeamHighlightItem[];
  recognitionOpportunities?: RecognitionItem[];
  teamConcerns?: TeamConcernItem[];
  workloadObservations?: WorkloadObservation[];
  supportNeeded?: SupportNeededItem[];
  developmentOpportunities?: DevelopmentOpportunity[];
  retentionRisks?: RetentionRisk[];
  recommendedHRActions?: HRAction[];
}

const getMoraleConfig = (morale: string) => {
  switch (morale) {
    case 'positive':
      return { label: 'Positive', icon: ThumbsUp, color: 'text-success', bgColor: 'bg-success/10', borderColor: 'border-success/30' };
    case 'mixed':
      return { label: 'Mixed', icon: AlertTriangle, color: 'text-warning', bgColor: 'bg-warning/10', borderColor: 'border-warning/30' };
    case 'concerning':
      return { label: 'Concerning', icon: AlertTriangle, color: 'text-destructive', bgColor: 'bg-destructive/10', borderColor: 'border-destructive/30' };
    default:
      return { label: 'Unknown', icon: Users, color: 'text-muted-foreground', bgColor: 'bg-muted/10', borderColor: 'border-white/10' };
  }
};

export default function FeedbackSummary() {
  const { toast } = useToast();
  const permissions = usePermissions();
  const [teamSummary, setTeamSummary] = useState<TeamSummary | null>(null);

  const { data: feedbackEntries = [] } = useQuery<FeedbackEntry[]>({ queryKey: ['/api/feedback-entries'] });
  const { data: peopleWithFeedback = [] } = useQuery<Person[]>({ queryKey: ['/api/people/feedback'] });
  const { data: reportingWeek } = useQuery<{ weekStart: string; weekEnd: string }>({
    queryKey: ['/api/reporting-week'],
  });

  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/generate-summary');
      return res.json();
    },
    onSuccess: (data) => {
      if (data.teamSummary) {
        setTeamSummary(data.teamSummary);
        toast({
          title: 'Team Feedback Summary Generated',
          description: 'AI insights from team feedback are ready',
        });
      } else {
        toast({
          title: 'No Feedback to Analyze',
          description: 'Submit some team feedback first',
          variant: 'destructive',
        });
      }
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to generate feedback summary',
        variant: 'destructive',
      });
    },
  });

  const downloadPDF = () => {
    if (!teamSummary) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let y = 20;
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Team Feedback AI Summary', pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Week: ${reportingWeek?.weekStart} to ${reportingWeek?.weekEnd}`, pageWidth / 2, y, { align: 'center' });
    y += 15;
    
    const moraleConfig = getMoraleConfig(teamSummary.overallTeamMorale);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Team Morale: ${moraleConfig.label}`, 20, y);
    y += 10;
    
    doc.setFontSize(11);
    doc.text('Summary', 20, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const summaryLines = doc.splitTextToSize(teamSummary.teamSummary, pageWidth - 40);
    doc.text(summaryLines, 20, y);
    y += summaryLines.length * 5 + 10;
    
    if (teamSummary.recognitionOpportunities?.length) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Recognition Opportunities', 20, y);
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      teamSummary.recognitionOpportunities.forEach((item) => {
        const text = `${item.memberName}: ${item.achievement}`;
        const lines = doc.splitTextToSize(text, pageWidth - 45);
        doc.text(lines, 25, y);
        y += lines.length * 4 + 3;
      });
      y += 5;
    }
    
    if (teamSummary.teamConcerns?.length) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Team Concerns', 20, y);
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      teamSummary.teamConcerns.forEach((item) => {
        const text = `[${item.severity.toUpperCase()}] ${item.concern}`;
        const lines = doc.splitTextToSize(text, pageWidth - 45);
        doc.text(lines, 25, y);
        y += lines.length * 4 + 3;
      });
    }
    
    doc.save(`team_feedback_summary_${reportingWeek?.weekEnd || 'report'}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-500" />
            Team Feedback AI Summary
          </h2>
          <p className="text-muted-foreground mt-1">
            AI-powered insights from feedback on {peopleWithFeedback.length} team members
          </p>
        </div>
        <div className="flex gap-2">
          {teamSummary && (
            <Button variant="outline" size="sm" onClick={downloadPDF} className="gap-2" data-testid="button-download-feedback-summary">
              <FileDown className="h-4 w-4" />
              Download PDF
            </Button>
          )}
          {permissions.canGenerateAISummary && (
            <Button 
              onClick={() => generateSummaryMutation.mutate()} 
              disabled={generateSummaryMutation.isPending}
              className="gap-2"
              data-testid="button-generate-feedback-summary"
            >
              {generateSummaryMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {teamSummary ? 'Regenerate' : 'Generate'} Summary
            </Button>
          )}
        </div>
      </div>

      {!teamSummary ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Feedback Summary Generated</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Generate an AI-powered summary to get insights from team feedback submissions.
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
                  <Users className="h-4 w-4" />
                )}
                Generate Summary
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className={`${getMoraleConfig(teamSummary.overallTeamMorale).bgColor} border ${getMoraleConfig(teamSummary.overallTeamMorale).borderColor}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {(() => {
                  const config = getMoraleConfig(teamSummary.overallTeamMorale);
                  const Icon = config.icon;
                  return <Icon className={`h-5 w-5 ${config.color}`} />;
                })()}
                Team Morale: {getMoraleConfig(teamSummary.overallTeamMorale).label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{teamSummary.teamSummary}</p>
            </CardContent>
          </Card>

          {teamSummary.teamHighlights && teamSummary.teamHighlights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-success">
                  <TrendingUp className="h-5 w-5" />
                  Team Highlights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[250px]">
                  <div className="space-y-3">
                    {teamSummary.teamHighlights.map((item, i) => (
                      <div key={i} className="p-3 rounded-lg bg-success/5 border border-success/20">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{item.memberName}</span>
                          <Badge variant="outline" className="text-xs">{item.project}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.highlight}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {teamSummary.recognitionOpportunities && teamSummary.recognitionOpportunities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Award className="h-5 w-5" />
                  Recognition Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[250px]">
                  <div className="space-y-3">
                    {teamSummary.recognitionOpportunities.map((item, i) => (
                      <div key={i} className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{item.memberName}</span>
                          <Badge variant="outline" className="text-xs">{item.project}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">{item.achievement}</p>
                        <p className="text-xs text-primary">{item.suggestedRecognition}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {teamSummary.teamConcerns && teamSummary.teamConcerns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-5 w-5" />
                  Team Concerns
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[250px]">
                  <div className="space-y-3">
                    {teamSummary.teamConcerns.map((item, i) => (
                      <div key={i} className="p-3 rounded-lg bg-warning/5 border border-warning/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={item.severity === 'high' ? 'destructive' : item.severity === 'medium' ? 'secondary' : 'outline'} className="text-xs">
                            {item.severity.toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{item.project}</Badge>
                        </div>
                        <p className="text-sm">{item.concern}</p>
                        {item.affectedMembers && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Affected: {Array.isArray(item.affectedMembers) ? item.affectedMembers.join(', ') : item.affectedMembers}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {teamSummary.recommendedHRActions && teamSummary.recommendedHRActions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-500">
                  <Lightbulb className="h-5 w-5" />
                  Recommended HR Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {teamSummary.recommendedHRActions.map((item, i) => (
                    <div key={i} className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
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
