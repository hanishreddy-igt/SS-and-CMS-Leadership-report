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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
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
import { Edit2, Save, X, CheckCircle2, AlertTriangle, AlertCircle, FileDown, RefreshCw, FileText, Filter, ChevronDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { WeeklyReport, ProjectLead, TeamMember, Project, TeamMemberFeedback } from '@shared/schema';

const healthStatusConfig = {
  'on-track': { label: 'On Track', icon: CheckCircle2, color: 'text-success', bgColor: 'bg-success/10' },
  'at-risk': { label: 'Needs Attention', icon: AlertTriangle, color: 'text-warning', bgColor: 'bg-warning/10' },
  'critical': { label: 'Critical', icon: AlertCircle, color: 'text-destructive', bgColor: 'bg-destructive/10' },
};

export default function ViewReports() {
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
  });
  
  const [filterLeads, setFilterLeads] = useState<Set<string>>(new Set());
  const [filterMembers, setFilterMembers] = useState<Set<string>>(new Set());
  const [filterHealth, setFilterHealth] = useState<string>('all');
  const [filterProjectStatus, setFilterProjectStatus] = useState<string>('all');
  const [leadSearch, setLeadSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');

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

  const startEdit = (report: WeeklyReport) => {
    if (report.status !== 'submitted') return;
    setEditingId(report.id);
    setEditData({
      progress: report.progress || '',
      challenges: report.challenges || '',
      nextWeek: report.nextWeek || '',
      healthStatus: report.healthStatus || '',
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
        description: 'All reports have been reset for next week' 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to reset reports',
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
  };

  const activeFilterCount = 
    (filterLeads.size > 0 ? 1 : 0) + 
    (filterMembers.size > 0 ? 1 : 0) + 
    (filterHealth !== 'all' ? 1 : 0) +
    (filterProjectStatus !== 'all' ? 1 : 0);

  const filteredReports = weeklyReports.filter((report) => {
    if (report.status !== 'submitted') return false;
    if (filterLeads.size > 0 && !filterLeads.has(report.leadId)) return false;
    if (filterHealth !== 'all' && report.healthStatus !== filterHealth) return false;
    
    const project = projects.find((p) => p.id === report.projectId);
    
    if (filterMembers.size > 0) {
      if (!project || !project.teamMemberIds.some(id => filterMembers.has(id))) return false;
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

  const filteredLeadsForSearch = projectLeads.filter(lead =>
    lead.name.toLowerCase().includes(leadSearch.toLowerCase())
  );

  const filteredMembersForSearch = teamMembers.filter(member =>
    member.name.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const exportToCSV = () => {
    const headers = ['Project', 'Lead', 'Week Start', 'Health Status', 'Progress', 'Challenges', 'Next Week', 'Team Feedback', 'Submitted'];
    const rows = sortedReports.map((report) => {
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
    const doc = new jsPDF({ orientation: 'landscape' });
    
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, doc.internal.pageSize.width, 25, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text('Weekly Leadership Reports', 14, 16);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 35);
    
    doc.setFontSize(12);
    doc.setTextColor(59, 130, 246);
    doc.text('Summary', 14, 45);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Total Reports: ${sortedReports.length}`, 20, 52);
    
    doc.setTextColor(34, 197, 94);
    doc.text(`On Track: ${onTrackCount}`, 20, 59);
    doc.setTextColor(245, 158, 11);
    doc.text(`Needs Attention: ${atRiskCount}`, 70, 59);
    doc.setTextColor(239, 68, 68);
    doc.text(`Critical: ${criticalCount}`, 140, 59);
    doc.setTextColor(0, 0, 0);

    const tableData = sortedReports.map((report) => {
      const feedback = report.teamMemberFeedback as TeamMemberFeedback[] | null;
      const feedbackText = feedback && feedback.length > 0
        ? feedback.map((f) => `${getMemberName(f.memberId)}: ${f.feedback}`).join('; ')
        : 'None';

      return [
        getProjectName(report.projectId),
        getLeadName(report.leadId),
        report.weekStart,
        healthStatusConfig[report.healthStatus as keyof typeof healthStatusConfig]?.label || report.healthStatus || '',
        report.progress || '',
        report.challenges || '',
        report.nextWeek || '',
        feedbackText,
      ];
    });

    autoTable(doc, {
      startY: 65,
      head: [['Project', 'Lead', 'Week', 'Status', 'Progress', 'Challenges', 'Next Week', 'Team Feedback']],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 25 },
        2: { cellWidth: 22 },
        3: { cellWidth: 28 },
        4: { cellWidth: 45 },
        5: { cellWidth: 45 },
        6: { cellWidth: 45 },
        7: { cellWidth: 35 },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const status = data.cell.raw as string;
          if (status === 'On Track') {
            data.cell.styles.textColor = [34, 197, 94];
            data.cell.styles.fontStyle = 'bold';
          } else if (status === 'Needs Attention') {
            data.cell.styles.textColor = [245, 158, 11];
            data.cell.styles.fontStyle = 'bold';
          } else if (status === 'Critical') {
            data.cell.styles.textColor = [239, 68, 68];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      didDrawPage: (data) => {
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Page ${data.pageNumber}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        );
        doc.setTextColor(0, 0, 0);
      },
    });

    doc.save(`weekly_reports_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-8">
      {/* Premium Health Status Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-label">Health Indicator</p>
              <p className="text-3xl font-bold tabular-nums text-success" data-testid="text-on-track">
                {onTrackCount}
              </p>
              <p className="text-sm text-muted-foreground mt-1">On Track</p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-label">Attention Required</p>
              <p className="text-3xl font-bold tabular-nums text-warning" data-testid="text-needs-attention">
                {atRiskCount}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Needs Attention</p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-warning" />
            </div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-label">Immediate Action</p>
              <p className="text-3xl font-bold tabular-nums text-destructive" data-testid="text-critical">
                {criticalCount}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Critical</p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
          </div>
        </div>
      </div>

      <Card className="glass-card border-white/10">
        <CardHeader className="border-b border-white/5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="section-label">Report Archive</p>
                <CardTitle className="text-2xl">Weekly Reports <span className="text-primary">({filteredReports.length})</span></CardTitle>
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
                              onClick={() => setFilterHealth(option.value)}
                            >
                              <Checkbox
                                checked={filterHealth === option.value}
                                onCheckedChange={() => setFilterHealth(option.value)}
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
                      data-testid="button-save"
                    >
                      <Save className="h-4 w-4" />
                      Save
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportToPDF} data-testid="menu-export-pdf">
                      <FileText className="h-4 w-4 mr-2" />
                      Save as PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportToCSV} data-testid="menu-export-csv">
                      <FileDown className="h-4 w-4 mr-2" />
                      Save as CSV
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      data-testid="button-reset-reports"
                      className="gap-2"
                      disabled={weeklyReports.length === 0}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Reset reports for next week
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset Reports for Next Week?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all {weeklyReports.length} weekly reports to prepare for a new reporting cycle. This action cannot be undone.
                        Make sure you have saved the reports as PDF or CSV before resetting.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid="button-cancel-reset">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        data-testid="button-confirm-reset"
                        onClick={() => deleteAllReportsMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={deleteAllReportsMutation.isPending}
                      >
                        {deleteAllReportsMutation.isPending ? 'Resetting...' : 'Reset All Reports'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sortedReports.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No reports found matching the filters.</p>
            ) : (
              sortedReports.map((report) => {
                const healthConfig = healthStatusConfig[report.healthStatus as keyof typeof healthStatusConfig];
                const HealthIcon = healthConfig?.icon || CheckCircle2;
                const feedback = report.teamMemberFeedback as TeamMemberFeedback[] | null;

                return (
                  <Card key={report.id} data-testid={`report-${report.id}`} className="glass-card border-white/10">
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
                            Week of <span className="text-primary">{report.weekStart}</span> • By {getLeadName(report.leadId)}
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
                          <div>
                            <h4 className="font-medium mb-1">Progress This Week</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {report.progress || 'No progress recorded'}
                            </p>
                          </div>
                          {report.challenges && (
                            <div>
                              <h4 className="font-medium mb-1">Challenges & Blockers</h4>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {report.challenges}
                              </p>
                            </div>
                          )}
                          <div>
                            <h4 className="font-medium mb-1">Plans for Next Week</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {report.nextWeek || 'No plans recorded'}
                            </p>
                          </div>
                          {feedback && feedback.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-2">Team Member Feedback</h4>
                              <div className="space-y-2">
                                {feedback.map((f, index) => (
                                  <div key={index} className="border-l-2 border-primary/30 pl-3">
                                    <p className="text-sm font-medium">{getMemberName(f.memberId)}</p>
                                    <p className="text-sm text-muted-foreground">{f.feedback}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">
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
    </div>
  );
}
