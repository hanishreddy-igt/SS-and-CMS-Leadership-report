import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Edit2, Save, X } from 'lucide-react';
import type { WeeklyReport, ProjectLead, TeamMember } from '@shared/schema';

interface ViewReportsProps {
  weeklyReports: WeeklyReport[];
  projectLeads: ProjectLead[];
  teamMembers: TeamMember[];
  onEditReport: (id: string, updates: Partial<WeeklyReport>) => void;
}

export default function ViewReports({
  weeklyReports,
  projectLeads,
  teamMembers,
  onEditReport,
}: ViewReportsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    progress: '',
    challenges: '',
    nextWeek: '',
  });

  const getLeadName = (leadId: string) => {
    return projectLeads.find((l) => l.id === leadId)?.name || 'Unknown';
  };

  const startEdit = (report: WeeklyReport) => {
    setEditingId(report.id);
    setEditData({
      progress: report.progress,
      challenges: report.challenges,
      nextWeek: report.nextWeek,
    });
  };

  const saveEdit = (reportId: string) => {
    onEditReport(reportId, editData);
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const sortedReports = [...weeklyReports].sort(
    (a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Weekly Reports ({weeklyReports.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sortedReports.map((report) => (
              <Card key={report.id} data-testid={`report-${report.id}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        Week of {report.weekStart}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        By {getLeadName(report.leadId)}
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
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
