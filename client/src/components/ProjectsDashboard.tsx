import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, Briefcase, Calendar, ArrowUpDown, Edit2, Search, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Project, ProjectLead, TeamMember } from '@shared/schema';

interface ProjectsDashboardProps {
  projects: Project[];
  projectLeads: ProjectLead[];
  teamMembers: TeamMember[];
  onEditProject: (id: string, updates: Partial<Omit<Project, 'id'>>) => void;
  onImportFromJira: (projectKey?: string) => Promise<boolean>;
}

type SortOrder = 'asc' | 'desc';

export default function ProjectsDashboard({
  projects,
  projectLeads,
  teamMembers,
  onEditProject,
  onImportFromJira,
}: ProjectsDashboardProps) {
  const [filterLead, setFilterLead] = useState<string>('all');
  const [filterMember, setFilterMember] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    customer: '',
    leadId: '',
    teamMemberIds: [] as string[],
    startDate: '',
    endDate: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [jiraProjectKey, setJiraProjectKey] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const totalTeamMembers = teamMembers.length;
  const totalLeads = projectLeads.length;

  const getLeadName = (leadId: string) => {
    return projectLeads.find((l) => l.id === leadId)?.name || 'Unknown';
  };

  const getTeamMemberNames = (memberIds: string[]) => {
    return memberIds
      .map((id) => teamMembers.find((m) => m.id === id)?.name)
      .filter(Boolean);
  };

  const filteredProjects = projects.filter((project) => {
    if (filterLead !== 'all' && project.leadId !== filterLead) return false;
    if (filterMember !== 'all' && !project.teamMemberIds.includes(filterMember)) return false;
    return true;
  });

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    const dateA = new Date(a.endDate).getTime();
    const dateB = new Date(b.endDate).getTime();
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  });

  const toggleSort = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const startEdit = (project: Project) => {
    setEditingProject(project);
    setEditFormData({
      name: project.name,
      customer: project.customer,
      leadId: project.leadId,
      teamMemberIds: project.teamMemberIds,
      startDate: project.startDate,
      endDate: project.endDate,
    });
    setSearchQuery('');
  };

  const handleSaveEdit = () => {
    if (editingProject && editFormData.name && editFormData.customer && editFormData.leadId && 
        editFormData.teamMemberIds.length > 0 && editFormData.startDate && editFormData.endDate) {
      onEditProject(editingProject.id, editFormData);
      setEditingProject(null);
      setSearchQuery('');
    }
  };

  const toggleTeamMember = (memberId: string) => {
    setEditFormData((prev) => ({
      ...prev,
      teamMemberIds: prev.teamMemberIds.includes(memberId)
        ? prev.teamMemberIds.filter((id) => id !== memberId)
        : [...prev.teamMemberIds, memberId],
    }));
  };

  const filteredTeamMembers = teamMembers.filter((member) =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleImport = async () => {
    setIsImporting(true);
    const success = await onImportFromJira(jiraProjectKey || undefined);
    setIsImporting(false);
    
    if (success) {
      setShowImportDialog(false);
      setJiraProjectKey('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Projects</p>
                <p className="text-3xl font-bold" data-testid="text-total-projects">
                  {projects.length}
                </p>
              </div>
              <Briefcase className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Team Members</p>
                <p className="text-3xl font-bold" data-testid="text-total-members">
                  {totalTeamMembers}
                </p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Project Leads</p>
                <p className="text-3xl font-bold" data-testid="text-total-leads">
                  {totalLeads}
                </p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-2xl">All Projects ({sortedProjects.length})</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
              <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                <DialogTrigger asChild>
                  <Button variant="default" className="gap-2" data-testid="button-import-jira">
                    <Download className="h-4 w-4" />
                    Import from Jira
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Import Projects from Jira</DialogTitle>
                    <DialogDescription>
                      Import epics from Jira as projects. Leave project key empty to import all epics.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="jira-project-key">Jira Project Key (Optional)</Label>
                      <Input
                        id="jira-project-key"
                        data-testid="input-jira-project-key"
                        placeholder="e.g., PROJ"
                        value={jiraProjectKey}
                        onChange={(e) => setJiraProjectKey(e.target.value.toUpperCase())}
                      />
                      <p className="text-sm text-muted-foreground">
                        Leave empty to import all epics from all projects
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowImportDialog(false);
                          setJiraProjectKey('');
                        }}
                        disabled={isImporting}
                        data-testid="button-cancel-import"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleImport}
                        disabled={isImporting}
                        data-testid="button-confirm-import"
                      >
                        {isImporting ? 'Importing...' : 'Import'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
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
              <Button
                variant="outline"
                onClick={toggleSort}
                data-testid="button-sort-date"
                className="gap-2"
              >
                <ArrowUpDown className="h-4 w-4" />
                End Date {sortOrder === 'asc' ? '↑' : '↓'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedProjects.map((project) => (
              <Card key={project.id} data-testid={`project-card-${project.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-xl">{project.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{project.customer}</p>
                    </div>
                    <Dialog open={editingProject?.id === project.id} onOpenChange={(open) => !open && setEditingProject(null)}>
                      <DialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEdit(project)}
                          data-testid={`button-edit-project-${project.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Edit Project</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="edit-name">Project Name</Label>
                            <Input
                              id="edit-name"
                              data-testid="input-edit-project-name"
                              value={editFormData.name}
                              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-customer">Customer</Label>
                            <Input
                              id="edit-customer"
                              data-testid="input-edit-customer"
                              value={editFormData.customer}
                              onChange={(e) => setEditFormData({ ...editFormData, customer: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-lead">Project Lead</Label>
                            <Select
                              value={editFormData.leadId}
                              onValueChange={(value) => setEditFormData({ ...editFormData, leadId: value })}
                            >
                              <SelectTrigger id="edit-lead" data-testid="select-edit-lead">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {projectLeads.map((lead) => (
                                  <SelectItem key={lead.id} value={lead.id}>
                                    {lead.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>Team Members</Label>
                              {editFormData.teamMemberIds.length > 0 && (
                                <Badge variant="secondary" data-testid="badge-edit-selected-count">
                                  {editFormData.teamMemberIds.length} selected
                                </Badge>
                              )}
                            </div>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="text"
                                placeholder="Search team members..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-9"
                                data-testid="input-edit-search-members"
                              />
                              {searchQuery && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setSearchQuery('')}
                                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                                  data-testid="button-edit-clear-search"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            <div className="border rounded-md p-4 space-y-2 max-h-48 overflow-y-auto">
                              {filteredTeamMembers.length > 0 ? (
                                filteredTeamMembers.map((member) => (
                                  <div key={member.id} className="flex items-center gap-2">
                                    <Checkbox
                                      id={`edit-member-${member.id}`}
                                      data-testid={`checkbox-edit-member-${member.id}`}
                                      checked={editFormData.teamMemberIds.includes(member.id)}
                                      onCheckedChange={() => toggleTeamMember(member.id)}
                                    />
                                    <Label htmlFor={`edit-member-${member.id}`} className="font-normal cursor-pointer">
                                      {member.name}
                                    </Label>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                  No team members found matching "{searchQuery}"
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="edit-start-date">Start Date</Label>
                              <Input
                                id="edit-start-date"
                                data-testid="input-edit-start-date"
                                type="date"
                                value={editFormData.startDate}
                                onChange={(e) => setEditFormData({ ...editFormData, startDate: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="edit-end-date">End Date</Label>
                              <Input
                                id="edit-end-date"
                                data-testid="input-edit-end-date"
                                type="date"
                                value={editFormData.endDate}
                                onChange={(e) => setEditFormData({ ...editFormData, endDate: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setEditingProject(null)}
                              data-testid="button-cancel-edit"
                            >
                              Cancel
                            </Button>
                            <Button onClick={handleSaveEdit} data-testid="button-save-edit">
                              Save Changes
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Lead:</span>
                    <span className="text-muted-foreground">{getLeadName(project.leadId)}</span>
                  </div>

                  <div className="flex items-start gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <span className="font-medium">Team:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {getTeamMemberNames(project.teamMemberIds).map((name, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {project.startDate} - {project.endDate}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
