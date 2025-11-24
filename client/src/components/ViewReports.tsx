import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
import { Edit2, Save, X, CheckCircle2, AlertTriangle, AlertCircle, FileDown, Trash2, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { WeeklyReport, ProjectLead, TeamMember, Project, TeamMemberFeedback } from '@shared/schema';

const healthStatusConfig = {
  'on-track': { label: 'On Track', icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-50' },
  'at-risk': { label: 'At Risk', icon: AlertTriangle, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  'critical': { label: 'Critical', icon: AlertCircle, color: 'text-red-600', bgColor: 'bg-red-50' },
};

export default function ViewReports() {
  const { toast } = useToast();
  const { data: weeklyReports = [] } = useQuery<WeeklyReport[]>({ queryKey: ['/api/weekly-reports'] });
  const { data: projectLeads = [] } = useQuery<ProjectLead[]>({ queryKey: ['/api/team-members'] });
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({ queryKey: ['/api/team-members'] });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ['/api/projects'] });
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

  const deleteAllReportsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('DELETE', '/api/weekly-reports', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/weekly-reports'] });
      toast({ 
        title: 'Success', 
        description: 'All reports deleted successfully' 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to delete reports',
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

  const exportToCSV = () => {
    const headers = ['Project', 'Lead', 'Week Start', 'Health Status', 'Progress', 'Challenges', 'Next Week', 'Submitted'];
    const rows = sortedReports.map((report) => [
      getProjectName(report.projectId),
      getLeadName(report.leadId),
      report.weekStart,
      healthStatusConfig[report.healthStatus as keyof typeof healthStatusConfig]?.label || report.healthStatus,
      report.progress.replace(/\n/g, ' '),
      report.challenges.replace(/\n/g, ' '),
      report.nextWeek.replace(/\n/g, ' '),
      new Date(report.submittedAt).toLocaleString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

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

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text('Weekly Leadership Reports', 14, 20);
    
    // Date
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    
    // Summary
    doc.setFontSize(12);
    doc.text('Summary', 14, 38);
    doc.setFontSize(10);
    doc.text(`Total Reports: ${sortedReports.length}`, 20, 45);
    doc.text(`On Track: ${onTrackCount} | At Risk: ${atRiskCount} | Critical: ${criticalCount}`, 20, 51);

    // Reports table
    const tableData = sortedReports.map((report) => {
      const feedback = report.teamMemberFeedback as TeamMemberFeedback[] | null;
      const feedbackText = feedback && feedback.length > 0
        ? feedback.map((f) => `${getMemberName(f.memberId)}: ${f.feedback}`).join('; ')
        : 'None';

      return [
        getProjectName(report.projectId),
        getLeadName(report.leadId),
        report.weekStart,
        healthStatusConfig[report.healthStatus as keyof typeof healthStatusConfig]?.label || report.healthStatus,
        report.progress,
        report.challenges,
        report.nextWeek,
        feedbackText,
      ];
    });

    autoTable(doc, {
      startY: 58,
      head: [['Project', 'Lead', 'Week', 'Status', 'Progress', 'Challenges', 'Next Week', 'Team Feedback']],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [66, 66, 66] },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 20 },
        3: { cellWidth: 20 },
        4: { cellWidth: 30 },
        5: { cellWidth: 30 },
        6: { cellWidth: 30 },
        7: { cellWidth: 30 },
      },
      didDrawPage: (data) => {
        // Footer
        doc.setFontSize(8);
        doc.text(
          `Page ${data.pageNumber}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        );
      },
    });

    doc.save(`weekly_reports_${new Date().toISOString().split('T')[0]}.pdf`);
  };

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
          <div className="flex flex-col gap-4">
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
            
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={exportToPDF}
                data-testid="button-export-pdf"
                className="gap-2"
                disabled={sortedReports.length === 0}
              >
                <FileText className="h-4 w-4" />
                Save as PDF
              </Button>
              <Button
                variant="outline"
                onClick={exportToCSV}
                data-testid="button-export-csv"
                className="gap-2"
                disabled={sortedReports.length === 0}
              >
                <FileDown className="h-4 w-4" />
                Save as CSV
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    data-testid="button-delete-all"
                    className="gap-2"
                    disabled={weeklyReports.length === 0}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete All Reports
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete All Reports?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all {weeklyReports.length} weekly reports. This action cannot be undone.
                      Make sure you have saved the reports as PDF or CSV before deleting.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      data-testid="button-confirm-delete"
                      onClick={() => deleteAllReportsMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={deleteAllReportsMutation.isPending}
                    >
                      {deleteAllReportsMutation.isPending ? 'Deleting...' : 'Delete All'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
                            disabled={editReportMutation.isPending}
                          >
                            <Save className="h-4 w-4 mr-2" />
                            {editReportMutation.isPending ? 'Saving...' : 'Save'}
                          </Button>
                          <Button
                            data-testid={`button-cancel-report-${report.id}`}
                            variant="outline"
                            onClick={cancelEdit}
                            disabled={editReportMutation.isPending}
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
