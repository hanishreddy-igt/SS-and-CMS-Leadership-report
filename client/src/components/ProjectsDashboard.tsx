import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Users, Briefcase, Calendar, ArrowUpDown, Edit2, Search, X, Download, Trash2, Check, Plus, UserPlus, Filter, MoreVertical, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import type { Project, ProjectLead, TeamMember, InsertProject } from '@shared/schema';

type SortOrder = 'asc' | 'desc';
type SortField = 'endDate' | 'startDate';

export default function ProjectsDashboard() {
  const { toast } = useToast();
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ['/api/projects'] });
  const { data: projectLeads = [] } = useQuery<ProjectLead[]>({ queryKey: ['/api/project-leads'] });
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({ queryKey: ['/api/team-members'] });
  const [filterLeads, setFilterLeads] = useState<string[]>([]);
  const [filterMembers, setFilterMembers] = useState<string[]>([]);
  const [filterProjectName, setFilterProjectName] = useState<string>('');
  const [filterMemberSearch, setFilterMemberSearch] = useState<string>('');
  const [filterLeadSearch, setFilterLeadSearch] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [sortField, setSortField] = useState<SortField>('endDate');
  
  // Bulk selection state - selection mode toggle
  const [selectionModeProjects, setSelectionModeProjects] = useState(false);
  const [selectionModeMembers, setSelectionModeMembers] = useState(false);
  const [selectionModeLeads, setSelectionModeLeads] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [showBulkDeleteProjects, setShowBulkDeleteProjects] = useState(false);
  const [showBulkDeleteMembers, setShowBulkDeleteMembers] = useState(false);
  const [showBulkDeleteLeads, setShowBulkDeleteLeads] = useState(false);
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
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [editMemberValue, setEditMemberValue] = useState('');
  const [editLeadValue, setEditLeadValue] = useState('');
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  // Add Project Modal State
  const [showAddProjectDialog, setShowAddProjectDialog] = useState(false);
  const [projectFormData, setProjectFormData] = useState({
    name: '',
    customer: '',
    leadId: '',
    teamMemberIds: [] as string[],
    startDate: '',
    endDate: '',
  });
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [projectFormErrors, setProjectFormErrors] = useState<Record<string, string>>({});

  // Add Team Member Modal State
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [newMember, setNewMember] = useState('');

  // Add Project Lead Modal State
  const [showAddLeadDialog, setShowAddLeadDialog] = useState(false);
  const [newLead, setNewLead] = useState('');

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
    if (filterLeads.length > 0 && !filterLeads.includes(project.leadId)) return false;
    if (filterMembers.length > 0 && !filterMembers.some(memberId => project.teamMemberIds.includes(memberId))) return false;
    if (filterProjectName && !project.name.toLowerCase().includes(filterProjectName.toLowerCase())) return false;
    return true;
  });

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    const dateField = sortField === 'endDate' ? 'endDate' : 'startDate';
    const dateA = a[dateField] ? new Date(a[dateField]!).getTime() : 0;
    const dateB = b[dateField] ? new Date(b[dateField]!).getTime() : 0;
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };
  
  // Filter member search results
  const filteredMembersForFilter = teamMembers.filter((member) =>
    member.name.toLowerCase().includes(filterMemberSearch.toLowerCase())
  );
  
  // Toggle lead in filter
  const toggleLeadFilter = (leadId: string) => {
    setFilterLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };
  
  // Toggle member in filter
  const toggleMemberFilter = (memberId: string) => {
    setFilterMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };
  
  // Bulk selection helpers
  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };
  
  const toggleMemberSelection = (memberId: string) => {
    setSelectedMembers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
  };
  
  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };
  
  const selectAllProjects = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedProjects(new Set(sortedProjects.map(p => p.id)));
    } else {
      setSelectedProjects(new Set());
    }
  };
  
  const selectAllMembers = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedMembers(new Set(teamMembers.map(m => m.id)));
    } else {
      setSelectedMembers(new Set());
    }
  };
  
  const selectAllLeads = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedLeads(new Set(projectLeads.map(l => l.id)));
    } else {
      setSelectedLeads(new Set());
    }
  };

  const startEdit = (project: Project) => {
    setEditingProject(project);
    setEditFormData({
      name: project.name,
      customer: project.customer,
      leadId: project.leadId,
      teamMemberIds: project.teamMemberIds,
      startDate: project.startDate || '',
      endDate: project.endDate || '',
    });
    setSearchQuery('');
  };

  const editProjectMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<Project, 'id'>> }) => {
      return await apiRequest('PATCH', `/api/projects/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ 
        title: 'Success', 
        description: 'Project updated successfully' 
      });
      setEditingProject(null);
      setSearchQuery('');
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to update project',
        variant: 'destructive'
      });
    }
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ 
        title: 'Success', 
        description: 'Project deleted successfully' 
      });
      setDeletingProjectId(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to delete project',
        variant: 'destructive'
      });
    }
  });

  const handleSaveEdit = () => {
    if (editingProject && editFormData.name && editFormData.customer && editFormData.leadId && 
        editFormData.teamMemberIds.length > 0) {
      editProjectMutation.mutate({ 
        id: editingProject.id, 
        updates: {
          ...editFormData,
          startDate: editFormData.startDate || null,
          endDate: editFormData.endDate || null,
        }
      });
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
    try {
      const response = await fetch('/api/jira/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectKey: jiraProjectKey || undefined }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Import failed');
      }

      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/team-members'] });
      queryClient.invalidateQueries({ queryKey: ['/api/project-leads'] });
      
      toast({ 
        title: 'Success', 
        description: 'Projects imported from Jira successfully' 
      });
      
      setShowImportDialog(false);
      setJiraProjectKey('');
    } catch (error) {
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to import from Jira',
        variant: 'destructive'
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Team member mutations
  const createMemberMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest('POST', '/api/team-members', { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-members'] });
      toast({ title: 'Success', description: 'Team member added' });
      setNewMember('');
      setShowAddMemberDialog(false);
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to add team member',
        variant: 'destructive'
      });
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return await apiRequest('PATCH', `/api/team-members/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-members'] });
      toast({ title: 'Success', description: 'Team member updated' });
      setEditingMemberId(null);
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to update team member',
        variant: 'destructive'
      });
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/team-members/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-members'] });
      toast({ title: 'Success', description: 'Team member deleted' });
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to delete team member',
        variant: 'destructive'
      });
    },
  });

  // Project lead mutations
  const createLeadMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest('POST', '/api/project-leads', { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-leads'] });
      toast({ title: 'Success', description: 'Project lead added' });
      setNewLead('');
      setShowAddLeadDialog(false);
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to add project lead',
        variant: 'destructive'
      });
    },
  });

  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return await apiRequest('PATCH', `/api/project-leads/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-leads'] });
      toast({ title: 'Success', description: 'Project lead updated' });
      setEditingLeadId(null);
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to update project lead',
        variant: 'destructive'
      });
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/project-leads/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-leads'] });
      toast({ title: 'Success', description: 'Project lead deleted' });
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to delete project lead',
        variant: 'destructive'
      });
    },
  });

  // Project mutations
  const createProjectMutation = useMutation({
    mutationFn: async (project: InsertProject) => {
      return await apiRequest('POST', '/api/projects', project);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ 
        title: 'Success', 
        description: 'Project created successfully' 
      });
      setProjectFormData({
        name: '',
        customer: '',
        leadId: '',
        teamMemberIds: [],
        startDate: '',
        endDate: '',
      });
      setProjectSearchQuery('');
      setProjectFormErrors({});
      setShowAddProjectDialog(false);
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to create project',
        variant: 'destructive'
      });
    }
  });

  const startEditMember = (member: TeamMember) => {
    setEditingMemberId(member.id);
    setEditMemberValue(member.name);
  };

  const startEditLead = (lead: ProjectLead) => {
    setEditingLeadId(lead.id);
    setEditLeadValue(lead.name);
  };

  const saveEditMember = (id: string) => {
    if (editMemberValue.trim()) {
      updateMemberMutation.mutate({ id, name: editMemberValue.trim() });
    }
  };

  const saveEditLead = (id: string) => {
    if (editLeadValue.trim()) {
      updateLeadMutation.mutate({ id, name: editLeadValue.trim() });
    }
  };

  const handleAddMember = () => {
    if (newMember.trim()) {
      createMemberMutation.mutate(newMember.trim());
    }
  };

  const handleAddLead = () => {
    if (newLead.trim()) {
      createLeadMutation.mutate(newLead.trim());
    }
  };

  const validateProjectForm = () => {
    const errors: Record<string, string> = {};
    if (!projectFormData.name.trim()) {
      errors.name = 'Project name is required';
    }
    if (!projectFormData.customer.trim()) {
      errors.customer = 'Customer is required';
    }
    if (!projectFormData.leadId) {
      errors.leadId = 'Project lead is required';
    }
    if (projectFormData.teamMemberIds.length === 0) {
      errors.teamMemberIds = 'At least one team member is required';
    }
    return errors;
  };

  const handleSubmitProject = (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateProjectForm();
    setProjectFormErrors(errors);
    
    if (Object.keys(errors).length === 0) {
      createProjectMutation.mutate({
        ...projectFormData,
        startDate: projectFormData.startDate || null,
        endDate: projectFormData.endDate || null,
      });
    } else {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
    }
  };

  const toggleProjectTeamMember = (memberId: string) => {
    setProjectFormData((prev) => ({
      ...prev,
      teamMemberIds: prev.teamMemberIds.includes(memberId)
        ? prev.teamMemberIds.filter((id) => id !== memberId)
        : [...prev.teamMemberIds, memberId],
    }));
  };

  const filteredProjectTeamMembers = teamMembers.filter((member) =>
    member.name.toLowerCase().includes(projectSearchQuery.toLowerCase())
  );

  const getActiveFilterCount = () => {
    let count = 0;
    if (filterProjectName) count++;
    if (filterLeads.length > 0) count += filterLeads.length;
    if (filterMembers.length > 0) count += filterMembers.length;
    return count;
  };

  const clearAllFilters = () => {
    setFilterProjectName('');
    setFilterLeads([]);
    setFilterMembers([]);
    setFilterMemberSearch('');
    setFilterLeadSearch('');
  };
  
  // Exit selection mode and clear selections
  const exitSelectionModeProjects = () => {
    setSelectionModeProjects(false);
    setSelectedProjects(new Set());
  };
  
  const exitSelectionModeMembers = () => {
    setSelectionModeMembers(false);
    setSelectedMembers(new Set());
  };
  
  const exitSelectionModeLeads = () => {
    setSelectionModeLeads(false);
    setSelectedLeads(new Set());
  };
  
  // Bulk delete mutations
  const bulkDeleteProjectsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => apiRequest('DELETE', `/api/projects/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ 
        title: 'Success', 
        description: `${selectedProjects.size} project(s) deleted successfully` 
      });
      setSelectedProjects(new Set());
      setShowBulkDeleteProjects(false);
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to delete projects',
        variant: 'destructive'
      });
    }
  });
  
  const bulkDeleteMembersMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => apiRequest('DELETE', `/api/team-members/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-members'] });
      toast({ 
        title: 'Success', 
        description: `${selectedMembers.size} team member(s) deleted successfully` 
      });
      setSelectedMembers(new Set());
      setShowBulkDeleteMembers(false);
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to delete team members',
        variant: 'destructive'
      });
    }
  });
  
  const bulkDeleteLeadsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => apiRequest('DELETE', `/api/project-leads/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-leads'] });
      toast({ 
        title: 'Success', 
        description: `${selectedLeads.size} project lead(s) deleted successfully` 
      });
      setSelectedLeads(new Set());
      setShowBulkDeleteLeads(false);
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to delete project leads',
        variant: 'destructive'
      });
    }
  });

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

      {/* All Projects Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-2xl">All Projects ({sortedProjects.length})</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
              {/* Add New Project Button */}
              <Dialog open={showAddProjectDialog} onOpenChange={(open) => {
                setShowAddProjectDialog(open);
                if (!open) {
                  setProjectFormData({
                    name: '',
                    customer: '',
                    leadId: '',
                    teamMemberIds: [],
                    startDate: '',
                    endDate: '',
                  });
                  setProjectSearchQuery('');
                  setProjectFormErrors({});
                }
              }}>
                <DialogTrigger asChild>
                  <Button variant="default" className="gap-2" data-testid="button-add-project">
                    <Plus className="h-4 w-4" />
                    Add New Project
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add New Project</DialogTitle>
                    <DialogDescription>
                      Create a new project with team members and project lead.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmitProject} className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-project-name">Project Name <span className="text-red-500">*</span></Label>
                      <Input
                        id="new-project-name"
                        data-testid="input-project-name"
                        type="text"
                        value={projectFormData.name}
                        onChange={(e) => {
                          setProjectFormData({ ...projectFormData, name: e.target.value });
                          if (projectFormErrors.name) {
                            setProjectFormErrors({ ...projectFormErrors, name: '' });
                          }
                        }}
                        placeholder="Enter project name"
                        className={projectFormErrors.name ? 'border-red-500' : ''}
                      />
                      {projectFormErrors.name && (
                        <p className="text-sm text-red-500" data-testid="error-project-name">{projectFormErrors.name}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-customer">Customer <span className="text-red-500">*</span></Label>
                      <Input
                        id="new-customer"
                        data-testid="input-customer"
                        type="text"
                        value={projectFormData.customer}
                        onChange={(e) => {
                          setProjectFormData({ ...projectFormData, customer: e.target.value });
                          if (projectFormErrors.customer) {
                            setProjectFormErrors({ ...projectFormErrors, customer: '' });
                          }
                        }}
                        placeholder="Enter customer name"
                        className={projectFormErrors.customer ? 'border-red-500' : ''}
                      />
                      {projectFormErrors.customer && (
                        <p className="text-sm text-red-500" data-testid="error-customer">{projectFormErrors.customer}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-lead">Project Lead <span className="text-red-500">*</span></Label>
                      <Select
                        value={projectFormData.leadId}
                        onValueChange={(value) => {
                          setProjectFormData({ ...projectFormData, leadId: value });
                          if (projectFormErrors.leadId) {
                            setProjectFormErrors({ ...projectFormErrors, leadId: '' });
                          }
                        }}
                      >
                        <SelectTrigger id="new-lead" data-testid="select-lead" className={projectFormErrors.leadId ? 'border-red-500' : ''}>
                          <SelectValue placeholder="Select project lead" />
                        </SelectTrigger>
                        <SelectContent>
                          {projectLeads.map((lead) => (
                            <SelectItem key={lead.id} value={lead.id}>
                              {lead.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {projectFormErrors.leadId && (
                        <p className="text-sm text-red-500" data-testid="error-lead">{projectFormErrors.leadId}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Team Members <span className="text-red-500">*</span></Label>
                        {projectFormData.teamMemberIds.length > 0 && (
                          <Badge variant="secondary" data-testid="badge-selected-count">
                            {projectFormData.teamMemberIds.length} selected
                          </Badge>
                        )}
                      </div>
                      
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Search team members..."
                          value={projectSearchQuery}
                          onChange={(e) => setProjectSearchQuery(e.target.value)}
                          className="pl-9 pr-9"
                          data-testid="input-search-members"
                        />
                        {projectSearchQuery && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setProjectSearchQuery('')}
                            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                            data-testid="button-clear-search"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className={`border rounded-md p-4 space-y-2 max-h-48 overflow-y-auto ${projectFormErrors.teamMemberIds ? 'border-red-500' : ''}`}>
                        {filteredProjectTeamMembers.length > 0 ? (
                          filteredProjectTeamMembers.map((member) => (
                            <div key={member.id} className="flex items-center gap-2">
                              <Checkbox
                                id={`new-member-${member.id}`}
                                data-testid={`checkbox-member-${member.id}`}
                                checked={projectFormData.teamMemberIds.includes(member.id)}
                                onCheckedChange={() => {
                                  toggleProjectTeamMember(member.id);
                                  if (projectFormErrors.teamMemberIds) {
                                    setProjectFormErrors({ ...projectFormErrors, teamMemberIds: '' });
                                  }
                                }}
                              />
                              <Label htmlFor={`new-member-${member.id}`} className="font-normal cursor-pointer">
                                {member.name}
                              </Label>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-results">
                            No team members found matching "{projectSearchQuery}"
                          </p>
                        )}
                      </div>
                      {projectFormErrors.teamMemberIds && (
                        <p className="text-sm text-red-500" data-testid="error-team-members">{projectFormErrors.teamMemberIds}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="new-start-date">Start Date</Label>
                        <Input
                          id="new-start-date"
                          data-testid="input-start-date"
                          type="date"
                          value={projectFormData.startDate}
                          onChange={(e) => setProjectFormData({ ...projectFormData, startDate: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-end-date">End Date</Label>
                        <Input
                          id="new-end-date"
                          data-testid="input-end-date"
                          type="date"
                          value={projectFormData.endDate}
                          onChange={(e) => setProjectFormData({ ...projectFormData, endDate: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowAddProjectDialog(false)}
                        data-testid="button-cancel-add-project"
                      >
                        Cancel
                      </Button>
                      <Button 
                        data-testid="button-submit-project" 
                        type="submit"
                        disabled={createProjectMutation.isPending}
                      >
                        {createProjectMutation.isPending ? 'Adding...' : 'Add Project'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2" data-testid="button-import-jira">
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

              {/* Sort & Filter Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2" data-testid="button-sort-filter">
                    <Filter className="h-4 w-4" />
                    Sort & Filter
                    {getActiveFilterCount() > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                        {getActiveFilterCount()}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Sort & Filter</h4>
                      {getActiveFilterCount() > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearAllFilters}
                          className="h-auto py-1 px-2 text-xs"
                          data-testid="button-clear-all-filters"
                        >
                          Clear all
                        </Button>
                      )}
                    </div>
                    
                    {/* Sort Options */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Sort By</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={sortField === 'endDate' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleSort('endDate')}
                          data-testid="button-sort-end-date"
                          className="flex-1 justify-between"
                        >
                          <span>End Date</span>
                          {sortField === 'endDate' && (
                            <ArrowUpDown className="h-3 w-3 ml-1" />
                          )}
                        </Button>
                        <Button
                          variant={sortField === 'startDate' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleSort('startDate')}
                          data-testid="button-sort-start-date"
                          className="flex-1 justify-between"
                        >
                          <span>Start Date</span>
                          {sortField === 'startDate' && (
                            <ArrowUpDown className="h-3 w-3 ml-1" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {sortOrder === 'asc' ? 'Earliest First' : 'Latest First'}
                      </p>
                    </div>

                    {/* Filter by Name */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Filter by Name</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Search projects..."
                          value={filterProjectName}
                          onChange={(e) => setFilterProjectName(e.target.value)}
                          className="pl-9 pr-9"
                          data-testid="input-filter-project-name"
                        />
                        {filterProjectName && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setFilterProjectName('')}
                            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                            data-testid="button-clear-filter-name"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Filter by Lead - Multi Select with Search */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Filter by Lead</Label>
                        {filterLeads.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {filterLeads.length} selected
                          </Badge>
                        )}
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Search leads..."
                          value={filterLeadSearch}
                          onChange={(e) => setFilterLeadSearch(e.target.value)}
                          className="pl-9 pr-9"
                          data-testid="input-filter-lead-search"
                        />
                        {filterLeadSearch && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setFilterLeadSearch('')}
                            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="border rounded-md p-2 space-y-1 max-h-[180px] overflow-y-auto" data-testid="filter-leads-container">
                        {projectLeads
                          .filter(lead => lead.name.toLowerCase().includes(filterLeadSearch.toLowerCase()))
                          .map((lead) => (
                          <div key={lead.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`filter-lead-${lead.id}`}
                              data-testid={`checkbox-filter-lead-${lead.id}`}
                              checked={filterLeads.includes(lead.id)}
                              onCheckedChange={() => toggleLeadFilter(lead.id)}
                            />
                            <Label 
                              htmlFor={`filter-lead-${lead.id}`} 
                              className="font-normal text-sm cursor-pointer flex-1"
                            >
                              {lead.name}
                            </Label>
                          </div>
                        ))}
                        {projectLeads.filter(lead => lead.name.toLowerCase().includes(filterLeadSearch.toLowerCase())).length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            {filterLeadSearch ? `No leads matching "${filterLeadSearch}"` : 'No leads available'}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Filter by Member - Multi Select with Search */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Filter by Member</Label>
                        {filterMembers.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {filterMembers.length} selected
                          </Badge>
                        )}
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Search members..."
                          value={filterMemberSearch}
                          onChange={(e) => setFilterMemberSearch(e.target.value)}
                          className="pl-9 pr-9"
                          data-testid="input-filter-member-search"
                        />
                        {filterMemberSearch && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setFilterMemberSearch('')}
                            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="border rounded-md p-2 space-y-1 max-h-[180px] overflow-y-auto" data-testid="filter-members-container">
                        {filteredMembersForFilter.map((member) => (
                          <div key={member.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`filter-member-${member.id}`}
                              data-testid={`checkbox-filter-member-${member.id}`}
                              checked={filterMembers.includes(member.id)}
                              onCheckedChange={() => toggleMemberFilter(member.id)}
                            />
                            <Label 
                              htmlFor={`filter-member-${member.id}`} 
                              className="font-normal text-sm cursor-pointer flex-1"
                            >
                              {member.name}
                            </Label>
                          </div>
                        ))}
                        {filteredMembersForFilter.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            {filterMemberSearch ? `No members matching "${filterMemberSearch}"` : 'No members available'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sortedProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-projects">
              No projects found. Click "Add New Project" to create one.
            </p>
          ) : (
            <>
              {/* Selection Mode Controls for Projects */}
              <div className="flex items-center gap-4 mb-4 pb-4 border-b">
                {!selectionModeProjects ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectionModeProjects(true)}
                    data-testid="button-enter-selection-projects"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Select
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectAllProjects(selectedProjects.size !== sortedProjects.length)}
                      data-testid="button-select-all-projects"
                    >
                      {selectedProjects.size === sortedProjects.length ? 'Deselect All' : 'Select All'}
                    </Button>
                    <Badge variant="secondary">{selectedProjects.size} selected</Badge>
                    {selectedProjects.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowBulkDeleteProjects(true)}
                        data-testid="button-bulk-delete-projects"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={exitSelectionModeProjects}
                      data-testid="button-exit-selection-projects"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedProjects.map((project) => (
                <Card 
                  key={project.id} 
                  data-testid={`project-card-${project.id}`} 
                  className={`${selectedProjects.has(project.id) ? 'ring-2 ring-primary bg-primary/5' : ''} ${selectionModeProjects ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
                  onClick={selectionModeProjects ? () => toggleProjectSelection(project.id) : undefined}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-start gap-3 flex-1">
                        {selectionModeProjects && (
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-1 ${selectedProjects.has(project.id) ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                            {selectedProjects.has(project.id) && <Check className="h-3 w-3 text-primary-foreground" />}
                          </div>
                        )}
                        <div className="flex-1">
                          <CardTitle className="text-xl">{project.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{project.customer}</p>
                        </div>
                      </div>
                      {!selectionModeProjects && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              data-testid={`button-project-menu-${project.id}`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => startEdit(project)}
                              data-testid={`button-edit-project-${project.id}`}
                            >
                              <Edit2 className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setDeletingProjectId(project.id)}
                              className="text-destructive focus:text-destructive"
                              data-testid={`button-delete-project-${project.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      <Dialog open={editingProject?.id === project.id} onOpenChange={(open) => !open && setEditingProject(null)}>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Edit Project</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="edit-name">Project Name <span className="text-red-500">*</span></Label>
                              <Input
                                id="edit-name"
                                data-testid="input-edit-project-name"
                                value={editFormData.name}
                                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="edit-customer">Customer <span className="text-red-500">*</span></Label>
                              <Input
                                id="edit-customer"
                                data-testid="input-edit-customer"
                                value={editFormData.customer}
                                onChange={(e) => setEditFormData({ ...editFormData, customer: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="edit-lead">Project Lead <span className="text-red-500">*</span></Label>
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
                                <Label>Team Members <span className="text-red-500">*</span></Label>
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
                              <Button 
                                onClick={handleSaveEdit} 
                                data-testid="button-save-edit"
                                disabled={editProjectMutation.isPending}
                              >
                                {editProjectMutation.isPending ? 'Saving...' : 'Save Changes'}
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

                    {(project.startDate || project.endDate) && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {project.startDate || 'N/A'} - {project.endDate || 'N/A'}
                        </span>
                      </div>
                    )}
                    
                    {/* End date missing warning */}
                    {!project.endDate && (
                      <div className="flex items-center gap-2 text-sm text-red-500 mt-2" data-testid={`text-missing-end-date-${project.id}`}>
                        <AlertCircle className="h-4 w-4" />
                        <span>End date is missing</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* All Team Members Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-2xl">All Team Members ({teamMembers.length})</CardTitle>
            <div className="flex gap-2">
              <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
                <DialogTrigger asChild>
                  <Button variant="default" className="gap-2" data-testid="button-add-member">
                    <UserPlus className="h-4 w-4" />
                    Add Team Member
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Team Member</DialogTitle>
                  <DialogDescription>
                    Add a new team member to the system.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-member-name">Team Member Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="new-member-name"
                      data-testid="input-member-name"
                      type="text"
                      value={newMember}
                      onChange={(e) => setNewMember(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddMember()}
                      placeholder="Enter team member name"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddMemberDialog(false);
                        setNewMember('');
                      }}
                      data-testid="button-cancel-add-member"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddMember}
                      disabled={createMemberMutation.isPending || !newMember.trim()}
                      data-testid="button-submit-member"
                    >
                      {createMemberMutation.isPending ? 'Adding...' : 'Add Member'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {teamMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-members">
              No team members added yet. Click "Add Team Member" to add one.
            </p>
          ) : (
            <>
              {/* Selection Mode Controls for Members */}
              <div className="flex items-center gap-4 mb-4 pb-4 border-b">
                {!selectionModeMembers ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectionModeMembers(true)}
                    data-testid="button-enter-selection-members"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Select
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectAllMembers(selectedMembers.size !== teamMembers.length)}
                      data-testid="button-select-all-members"
                    >
                      {selectedMembers.size === teamMembers.length ? 'Deselect All' : 'Select All'}
                    </Button>
                    <Badge variant="secondary">{selectedMembers.size} selected</Badge>
                    {selectedMembers.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowBulkDeleteMembers(true)}
                        data-testid="button-bulk-delete-members"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={exitSelectionModeMembers}
                      data-testid="button-exit-selection-members"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {teamMembers.map((member) => (
              <div
                key={member.id}
                className={`flex items-center justify-between bg-muted/50 p-3 rounded-md transition-colors ${selectedMembers.has(member.id) ? 'ring-2 ring-primary bg-primary/5' : ''} ${selectionModeMembers ? 'cursor-pointer hover:bg-muted' : ''}`}
                data-testid={`member-item-${member.id}`}
                onClick={selectionModeMembers && editingMemberId !== member.id ? () => toggleMemberSelection(member.id) : undefined}
              >
                {editingMemberId === member.id ? (
                  <div className="flex-1 flex gap-2">
                    <Input
                      data-testid={`input-edit-member-${member.id}`}
                      type="text"
                      value={editMemberValue}
                      onChange={(e) => setEditMemberValue(e.target.value)}
                      className="flex-1"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Button
                      data-testid={`button-save-member-${member.id}`}
                      size="icon"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); saveEditMember(member.id); }}
                      disabled={updateMemberMutation.isPending}
                      className="text-green-600 hover:text-green-700"
                    >
                      <Check className="h-5 w-5" />
                    </Button>
                    <Button
                      data-testid={`button-cancel-member-${member.id}`}
                      size="icon"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); setEditingMemberId(null); }}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      {selectionModeMembers && (
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selectedMembers.has(member.id) ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                          {selectedMembers.has(member.id) && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                      )}
                      <span data-testid={`text-member-${member.id}`} className="font-medium">
                        {member.name}
                      </span>
                    </div>
                    {!selectionModeMembers && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            data-testid={`button-member-menu-${member.id}`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => startEditMember(member)}
                            data-testid={`button-edit-member-${member.id}`}
                          >
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => deleteMemberMutation.mutate(member.id)}
                            disabled={deleteMemberMutation.isPending}
                            className="text-destructive focus:text-destructive"
                            data-testid={`button-delete-member-${member.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </>
                )}
              </div>
              ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* All Project Leads Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-2xl">All Project Leads ({projectLeads.length})</CardTitle>
            <div className="flex gap-2">
              <Dialog open={showAddLeadDialog} onOpenChange={setShowAddLeadDialog}>
                <DialogTrigger asChild>
                  <Button variant="default" className="gap-2" data-testid="button-add-lead">
                    <UserPlus className="h-4 w-4" />
                    Add Project Lead
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Project Lead</DialogTitle>
                  <DialogDescription>
                    Add a new project lead to the system.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-lead-name">Project Lead Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="new-lead-name"
                      data-testid="input-lead-name"
                      type="text"
                      value={newLead}
                      onChange={(e) => setNewLead(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddLead()}
                      placeholder="Enter project lead name"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddLeadDialog(false);
                        setNewLead('');
                      }}
                      data-testid="button-cancel-add-lead"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddLead}
                      disabled={createLeadMutation.isPending || !newLead.trim()}
                      data-testid="button-submit-lead"
                    >
                      {createLeadMutation.isPending ? 'Adding...' : 'Add Lead'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {projectLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-leads">
              No project leads added yet. Click "Add Project Lead" to add one.
            </p>
          ) : (
            <>
              {/* Selection Mode Controls for Leads */}
              <div className="flex items-center gap-4 mb-4 pb-4 border-b">
                {!selectionModeLeads ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectionModeLeads(true)}
                    data-testid="button-enter-selection-leads"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Select
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectAllLeads(selectedLeads.size !== projectLeads.length)}
                      data-testid="button-select-all-leads"
                    >
                      {selectedLeads.size === projectLeads.length ? 'Deselect All' : 'Select All'}
                    </Button>
                    <Badge variant="secondary">{selectedLeads.size} selected</Badge>
                    {selectedLeads.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowBulkDeleteLeads(true)}
                        data-testid="button-bulk-delete-leads"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={exitSelectionModeLeads}
                      data-testid="button-exit-selection-leads"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {projectLeads.map((lead) => (
              <div
                key={lead.id}
                className={`flex items-center justify-between bg-muted/50 p-3 rounded-md transition-colors ${selectedLeads.has(lead.id) ? 'ring-2 ring-primary bg-primary/5' : ''} ${selectionModeLeads ? 'cursor-pointer hover:bg-muted' : ''}`}
                data-testid={`lead-item-${lead.id}`}
                onClick={selectionModeLeads && editingLeadId !== lead.id ? () => toggleLeadSelection(lead.id) : undefined}
              >
                {editingLeadId === lead.id ? (
                  <div className="flex-1 flex gap-2">
                    <Input
                      data-testid={`input-edit-lead-${lead.id}`}
                      type="text"
                      value={editLeadValue}
                      onChange={(e) => setEditLeadValue(e.target.value)}
                      className="flex-1"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Button
                      data-testid={`button-save-lead-${lead.id}`}
                      size="icon"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); saveEditLead(lead.id); }}
                      disabled={updateLeadMutation.isPending}
                      className="text-green-600 hover:text-green-700"
                    >
                      <Check className="h-5 w-5" />
                    </Button>
                    <Button
                      data-testid={`button-cancel-lead-${lead.id}`}
                      size="icon"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); setEditingLeadId(null); }}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      {selectionModeLeads && (
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selectedLeads.has(lead.id) ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                          {selectedLeads.has(lead.id) && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                      )}
                      <span data-testid={`text-lead-${lead.id}`} className="font-medium">
                        {lead.name}
                      </span>
                    </div>
                    {!selectionModeLeads && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            data-testid={`button-lead-menu-${lead.id}`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => startEditLead(lead)}
                            data-testid={`button-edit-lead-${lead.id}`}
                          >
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => deleteLeadMutation.mutate(lead.id)}
                            disabled={deleteLeadMutation.isPending}
                            className="text-destructive focus:text-destructive"
                            data-testid={`button-delete-lead-${lead.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </>
                )}
              </div>
              ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Project Confirmation Dialog */}
      <Dialog open={!!deletingProjectId} onOpenChange={(open) => !open && setDeletingProjectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this project? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setDeletingProjectId(null)}
              data-testid="button-cancel-delete-project"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deletingProjectId) {
                  deleteProjectMutation.mutate(deletingProjectId);
                }
              }}
              disabled={deleteProjectMutation.isPending}
              data-testid="button-confirm-delete-project"
            >
              {deleteProjectMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Projects Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteProjects} onOpenChange={setShowBulkDeleteProjects}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedProjects.size} Project(s)</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedProjects.size} selected project(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-bulk-delete-projects">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteProjectsMutation.mutate(Array.from(selectedProjects))}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-bulk-delete-projects"
            >
              {bulkDeleteProjectsMutation.isPending ? 'Deleting...' : 'Delete All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Members Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteMembers} onOpenChange={setShowBulkDeleteMembers}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedMembers.size} Team Member(s)</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedMembers.size} selected team member(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-bulk-delete-members">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMembersMutation.mutate(Array.from(selectedMembers))}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-bulk-delete-members"
            >
              {bulkDeleteMembersMutation.isPending ? 'Deleting...' : 'Delete All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Leads Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteLeads} onOpenChange={setShowBulkDeleteLeads}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedLeads.size} Project Lead(s)</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedLeads.size} selected project lead(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-bulk-delete-leads">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteLeadsMutation.mutate(Array.from(selectedLeads))}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-bulk-delete-leads"
            >
              {bulkDeleteLeadsMutation.isPending ? 'Deleting...' : 'Delete All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
