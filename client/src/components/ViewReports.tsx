import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Edit2, Save, X, CheckCircle2, AlertTriangle, AlertCircle, TrendingUp } from 'lucide-react';
import type { WeeklyReport, ProjectLead, TeamMember, Project, TeamMemberFeedback } from '@shared/schema';

interface ViewReportsProps {
  weeklyReports: WeeklyReport[];
  projectLeads: ProjectLead[];
  teamMembers: TeamMember[];
  projects: Project[];
  onEditReport: (id: string, updates: Partial<WeeklyReport>) => void;
}

const healthStatusConfig = {
  'on-track': { label: 'On Track', icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-50' },
  'at-risk': { label: 'At Risk', icon: AlertTriangle, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  'critical': { label: 'Critical', icon: AlertCircle, color: 'text-red-600', bgColor: 'bg-red-50' },
};

export default function ViewReports({
  weeklyReports,
  projectLeads,
  teamMembers,
  projects,
  onEditReport,
}: ViewReportsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    progress: '',
    challenges: '',
    nextWeek: '',
    healthStatus: '',
  });
  const [filterLead, setFilterLead] = useState<string>('all');
  const [filterMember, setFilterMember] = useState<string>('all');
  const [filterHealth, setFilterHealth] = useState<string>('all');

  const getLeadName = (leadId: string) => {
    return projectLeads.find((l) => l.id === leadId)?.name || 'Unknown';
  };

  const getProjectName = (projectId: string) => {
    return projects.find((p) => p.id === projectId)?.name || 'Unknown Project';
  };

  const getMemberName = (memberId: string) => {
    return teamMembers.find((m) => m.id === memberId)?.name || 'Unknown';
  };

  const startEdit = (report: WeeklyReport) => {
    setEditingId(report.id);
    setEditData({
      progress: report.progress,
      challenges: report.challenges,
      nextWeek: report.nextWeek,
      healthStatus: report.healthStatus,
    });
  };

  const saveEdit = (reportId: string) => {
    onEditReport(reportId, editData);
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const filteredReports = weeklyReports.filter((report) => {
    if (filterLead !== 'all' && report.leadId !== filterLead) return false;
    if (filterHealth !== 'all' && report.healthStatus !== filterHealth) return false;
    
    if (filterMember !== 'all') {
      const project = projects.find((p) => p.id === report.projectId);
      if (!project || !project.teamMemberIds.includes(filterMember)) return false;
    }
    
    return true;
  });

  const onTrackCount = filteredReports.filter((r) => r.healthStatus === 'on-track').length;
  const atRiskCount = filteredReports.filter((r) => r.healthStatus === 'at-risk').length;
  const criticalCount = filteredReports.filter((r) => r.healthStatus === 'critical').length;

  const sortedReports = [...filteredReports].sort(
    (a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">On Track</p>
                <p className="text-3xl font-bold text-green-600" data-testid="text-on-track">
                  {onTrackCount}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">At Risk</p>
                <p className="text-3xl font-bold text-amber-600" data-testid="text-at-risk">
                  {atRiskCount}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-3xl font-bold text-red-600" data-testid="text-critical">
                  {criticalCount}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-2xl">Weekly Reports ({filteredReports.length})</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={filterLead} onValueChange={setFilterLead}>
                <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-filter-lead">
                  <SelectValue placeholder="Filter by lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Leads</SelectItem>
                  {projectLeads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterMember} onValueChange={setFilterMember}>
                <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-filter-member">
                  <SelectValue placeholder="Filter by member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterHealth} onValueChange={setFilterHealth}>
                <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-filter-health">
                  <SelectValue placeholder="Filter by health" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="on-track">On Track</SelectItem>
                  <SelectItem value="at-risk">At Risk</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sortedReports.map((report) => {
              const healthConfig = healthStatusConfig[report.healthStatus as keyof typeof healthStatusConfig];
              const HealthIcon = healthConfig?.icon || CheckCircle2;
              const feedback = report.teamMemberFeedback as TeamMemberFeedback[] | null;

              return (
                <Card key={report.id} data-testid={`report-${report.id}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CardTitle className="text-lg">
                            {getProjectName(report.projectId)}
                          </CardTitle>
                          {healthConfig && (
                            <Badge variant="outline" className="gap-1">
                              <HealthIcon className={`h-3 w-3 ${healthConfig.color}`} />
                              <span className={healthConfig.color}>{healthConfig.label}</span>
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Week of {report.weekStart} • By {getLeadName(report.leadId)}
                        </p>
                      </div>
                      {editingId !== report.id && (
                        <Button
                          data-testid={`button-edit-report-${report.id}`}
                          size="icon"
                          variant="ghost"
                          onClick={() => startEdit(report)}
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
                              <SelectItem value="at-risk">At Risk</SelectItem>
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
                            data-testid={`button-save-report-${report.id}`}
                            onClick={() => saveEdit(report.id)}
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Save
                          </Button>
                          <Button
                            data-testid={`button-cancel-report-${report.id}`}
                            variant="outline"
                            onClick={cancelEdit}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <h4 className="font-semibold mb-2">Progress This Week</h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {report.progress}
                          </p>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Challenges & Blockers</h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {report.challenges}
                          </p>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Plans for Next Week</h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {report.nextWeek}
                          </p>
                        </div>
                        {feedback && feedback.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-3">Team Member Feedback</h4>
                            <div className="space-y-2">
                              {feedback.map((item, idx) => (
                                <div key={idx} className="bg-muted/50 rounded-md p-3">
                                  <p className="font-medium text-sm mb-1">
                                    {getMemberName(item.memberId)}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {item.feedback}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
