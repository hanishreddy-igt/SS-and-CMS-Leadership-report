import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { 
  ChevronRight, 
  Plus,
  Minus,
  FolderKanban,
  Circle,
  Play,
  Check,
  Ban,
  Filter,
  X,
  TriangleAlert,
  StickyNote
} from 'lucide-react';
import type { Task, Project, Person } from '@shared/schema';
import { TaskRow, ParsedTitle, parseInlineTags } from './WorkingSpace';

export default function AllTasksByProject() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [leadFilter, setLeadFilter] = useState<string>('all');
  const [accountFilters, setAccountFilters] = useState<string[]>([]);
  const [memberFilter, setMemberFilter] = useState<string>('all');
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close task details when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      // Don't close if clicking inside the container
      if (containerRef.current?.contains(target)) return;
      // Don't close if clicking inside a Radix portal (dropdown, popover, etc.)
      if (target.closest?.('[data-radix-popper-content-wrapper]') ||
          target.closest?.('[role="menu"]') ||
          target.closest?.('[role="dialog"]') ||
          target.closest?.('[role="listbox"]')) {
        return;
      }
      setOpenTaskId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data: allTasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ['/api/tasks'],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const { data: people = [] } = useQuery<Person[]>({
    queryKey: ['/api/people'],
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      const res = await apiRequest('PATCH', `/api/tasks/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/tasks/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({ title: 'Task deleted' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (task: Partial<Task>) => {
      const res = await apiRequest('POST', '/api/tasks', task);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const userEmail = user?.email || '';

  const handleUpdateTask = (id: string, updates: Partial<Task>) => {
    updateTaskMutation.mutate({ id, updates });
  };

  const handleDeleteTask = (id: string) => {
    deleteTaskMutation.mutate(id);
  };

  const handleCreateTask = (title: string, parsed: ParsedTitle, parentTaskId?: string) => {
    const taskData: Partial<Task> = { 
      title: parsed.text || title, 
      parentTaskId: parentTaskId || undefined,
      status: parsed.statusTag || 'todo',
      priority: parsed.priorityTag || 'normal',
      assignedTo: [],
    };
    
    if (parsed.projectTag) {
      const projectTag = parsed.projectTag.toLowerCase();
      const matchedProject = projects.find(p => {
        const normalizedName = p.name.toLowerCase().replace(/\s+/g, '');
        return normalizedName === projectTag || normalizedName.startsWith(projectTag);
      });
      if (matchedProject) taskData.projectId = matchedProject.id;
    }
    
    if (parsed.personTags.length > 0) {
      const matchedPeople = people.filter(p => 
        parsed.personTags.some(tag => 
          p.name.toLowerCase().includes(tag.toLowerCase()) ||
          p.name.split(' ')[0].toLowerCase() === tag.toLowerCase()
        )
      );
      if (matchedPeople.length > 0) {
        taskData.assignedTo = matchedPeople.map(p => p.id);
      }
    }
    
    if (parsed.noteText) {
      taskData.notes = [{
        id: crypto.randomUUID(),
        content: parsed.noteText,
        createdAt: new Date().toISOString(),
        createdBy: userEmail
      }];
    }
    
    createTaskMutation.mutate(taskData);
  };

  const handleIndent = (taskId: string) => {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    
    const siblings = allTasks.filter(t => t.parentTaskId === task.parentTaskId && !t.parentTaskId);
    const taskIndex = siblings.findIndex(t => t.id === taskId);
    
    if (taskIndex > 0) {
      const newParent = siblings[taskIndex - 1];
      handleUpdateTask(taskId, { parentTaskId: newParent.id });
    }
  };

  const handleOutdent = (taskId: string) => {
    const task = allTasks.find(t => t.id === taskId);
    if (!task || !task.parentTaskId) return;
    
    const parent = allTasks.find(t => t.id === task.parentTaskId);
    if (parent) {
      handleUpdateTask(taskId, { parentTaskId: parent.parentTaskId || undefined });
    }
  };

  const projectLeads = useMemo(() => {
    const leadIds = new Set<string>();
    projects.forEach(p => {
      if (p.leadId) leadIds.add(p.leadId);
      if (p.leadIds) p.leadIds.forEach(id => leadIds.add(id));
    });
    return people.filter(p => leadIds.has(p.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, people]);

  const teamMembers = useMemo(() => {
    return people
      .filter(p => p.roles?.includes('team-member'))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [people]);

  const sortedAccounts = useMemo(() => {
    return [...projects].sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  // Helper to check if a task or any of its subtasks match the member filter
  const taskMatchesMemberFilter = (task: Task, memberId: string): boolean => {
    if (task.assignedTo?.includes(memberId)) return true;
    // Check subtasks recursively
    const subtasks = allTasks.filter(t => t.parentTaskId === task.id);
    return subtasks.some(st => taskMatchesMemberFilter(st, memberId));
  };

  // Filter tasks by member - returns tasks where the task or any subtask is assigned to the member
  const getFilteredTasks = (tasks: Task[]): Task[] => {
    if (memberFilter === 'all') return tasks;
    return tasks.filter(task => taskMatchesMemberFilter(task, memberFilter));
  };

  const accountsWithTasks = projects.filter(p => {
    // Only show accounts that have root tasks (not just orphaned subtasks)
    const hasRootTasks = allTasks.some(t => t.projectId === p.id && !t.parentTaskId);
    if (!hasRootTasks) return false;
    
    // Apply account filter (multi-select)
    if (accountFilters.length > 0 && !accountFilters.includes(p.id)) return false;
    
    // Apply lead filter
    if (leadFilter !== 'all') {
      const matchesLead = p.leadId === leadFilter || (p.leadIds && p.leadIds.includes(leadFilter));
      if (!matchesLead) return false;
    }
    
    // Apply member filter - check if any task in this account is assigned to the member
    if (memberFilter !== 'all') {
      const accountTasks = allTasks.filter(t => t.projectId === p.id);
      const hasTaskWithMember = accountTasks.some(t => taskMatchesMemberFilter(t, memberFilter));
      if (!hasTaskWithMember) return false;
    }
    
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name));

  const tasksWithoutAccount = allTasks.filter(t => !t.projectId && !t.parentTaskId);
  // Apply member filter to unassigned tasks
  const filteredTasksWithoutAccount = getFilteredTasks(tasksWithoutAccount);

  if (tasksLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Card ref={containerRef} data-testid="all-tasks-section">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FolderKanban className="h-5 w-5" />
            All Tasks in SSCMA
          </CardTitle>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" data-testid="filter-button">
                <Filter className="h-4 w-4" />
                Filters
                {(accountFilters.length > 0 || leadFilter !== 'all' || memberFilter !== 'all') && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                    {[accountFilters.length > 0, leadFilter !== 'all', memberFilter !== 'all'].filter(Boolean).length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Accounts</Label>
                    {accountFilters.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setAccountFilters([])}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  {accountFilters.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {accountFilters.map(id => {
                        const account = sortedAccounts.find(a => a.id === id);
                        return (
                          <Badge key={id} variant="secondary" className="gap-1 pr-1">
                            {account?.name || id}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 hover:bg-transparent"
                              onClick={() => setAccountFilters(prev => prev.filter(a => a !== id))}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                  <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                    {sortedAccounts.map(account => (
                      <div 
                        key={account.id} 
                        className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted cursor-pointer"
                        onClick={() => {
                          setAccountFilters(prev => 
                            prev.includes(account.id) 
                              ? prev.filter(id => id !== account.id)
                              : [...prev, account.id]
                          );
                        }}
                      >
                        <Checkbox 
                          checked={accountFilters.includes(account.id)}
                          onCheckedChange={(checked) => {
                            setAccountFilters(prev => 
                              checked 
                                ? [...prev, account.id]
                                : prev.filter(id => id !== account.id)
                            );
                          }}
                          data-testid={`account-filter-${account.id}`}
                        />
                        <span className="text-sm">{account.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Lead</Label>
                  <Select value={leadFilter} onValueChange={setLeadFilter}>
                    <SelectTrigger className="w-full" data-testid="lead-filter">
                      <SelectValue placeholder="All Leads" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Leads</SelectItem>
                      {projectLeads.map(lead => (
                        <SelectItem key={lead.id} value={lead.id}>{lead.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Team Member</Label>
                  <Select value={memberFilter} onValueChange={setMemberFilter}>
                    <SelectTrigger className="w-full" data-testid="member-filter">
                      <SelectValue placeholder="All Members" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Members</SelectItem>
                      {teamMembers.map(member => (
                        <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(accountFilters.length > 0 || leadFilter !== 'all' || memberFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setAccountFilters([]);
                      setLeadFilter('all');
                      setMemberFilter('all');
                    }}
                    data-testid="clear-filters-button"
                  >
                    Clear all filters
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-700 dark:text-amber-400 mb-3">
          <TriangleAlert className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm leading-relaxed">Please add your end-of-shift reports or the work you did on the task as notes <StickyNote className="h-4 w-4 inline-block align-text-bottom mx-0.5" /> before closing a task.</p>
        </div>
        {accountsWithTasks.length === 0 && filteredTasksWithoutAccount.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <FolderKanban className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p>No team tasks yet. Tasks from all team members will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {accountsWithTasks.map(account => {
              const priorityOrder: Record<string, number> = { high: 2, medium: 1, normal: 0 };
              const sortByPriority = (tasks: Task[]) => 
                [...tasks].sort((a, b) => (priorityOrder[b.priority || 'normal'] || 0) - (priorityOrder[a.priority || 'normal'] || 0));
              
              const accountTasks = allTasks.filter(t => t.projectId === account.id && !t.parentTaskId);
              // Apply member filter to only show tasks assigned to the selected member
              const filteredAccountTasks = getFilteredTasks(accountTasks);
              const activeTasks = sortByPriority(filteredAccountTasks.filter(t => t.status === 'todo' || t.status === 'in-progress'));
              const blockedTasks = sortByPriority(filteredAccountTasks.filter(t => t.status === 'blocked'));
              const closedTasks = sortByPriority(filteredAccountTasks.filter(t => t.status === 'done'));
              
              return (
                <Collapsible key={account.id} defaultOpen={false}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded-lg hover-elevate text-left group">
                    <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                    <FolderKanban className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">{account.name}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {filteredAccountTasks.length}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border rounded-lg mt-2 bg-card space-y-2 p-2">
                      {activeTasks.length > 0 && (
                        <Collapsible defaultOpen={true}>
                          <CollapsibleTrigger className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-muted/50 hover:bg-muted w-full text-left group">
                            <Plus className="h-4 w-4 group-data-[state=open]:hidden" />
                            <Minus className="h-4 w-4 hidden group-data-[state=open]:block" />
                            <Play className="h-4 w-4 text-green-500 fill-green-500" />
                            To-do / In-progress ({activeTasks.length})
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border rounded-md bg-background mt-1">
                              {activeTasks.map(task => (
                                <TaskRow
                                  key={task.id}
                                  task={task}
                                  allTasks={allTasks}
                                  projects={projects}
                                  people={people}
                                  onUpdate={handleUpdateTask}
                                  onDelete={handleDeleteTask}
                                  onCreateSubtask={(parentId, title, parsed) => handleCreateTask(title, parsed, parentId)}
                                  onIndent={handleIndent}
                                  onOutdent={handleOutdent}
                                  userEmail={userEmail}
                                  hideProjectBadge={true}
                                  showDetailsToggle={true}
                                  openTaskId={openTaskId}
                                  onOpenDetails={setOpenTaskId}
                                />
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                      
                      {blockedTasks.length > 0 && (
                        <Collapsible defaultOpen={true}>
                          <CollapsibleTrigger className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-muted/50 hover:bg-muted w-full text-left group">
                            <Plus className="h-4 w-4 group-data-[state=open]:hidden" />
                            <Minus className="h-4 w-4 hidden group-data-[state=open]:block" />
                            <Ban className="h-4 w-4 text-red-500" />
                            Blockers ({blockedTasks.length})
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border rounded-md mt-1">
                              {blockedTasks.map(task => (
                                <TaskRow
                                  key={task.id}
                                  task={task}
                                  allTasks={allTasks}
                                  projects={projects}
                                  people={people}
                                  onUpdate={handleUpdateTask}
                                  onDelete={handleDeleteTask}
                                  onCreateSubtask={(parentId, title, parsed) => handleCreateTask(title, parsed, parentId)}
                                  onIndent={handleIndent}
                                  onOutdent={handleOutdent}
                                  userEmail={userEmail}
                                  hideProjectBadge={true}
                                  showDetailsToggle={true}
                                  openTaskId={openTaskId}
                                  onOpenDetails={setOpenTaskId}
                                />
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                      
                      {closedTasks.length > 0 && (
                        <Collapsible defaultOpen={false}>
                          <CollapsibleTrigger className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-muted/50 hover:bg-muted w-full text-left group">
                            <Plus className="h-4 w-4 group-data-[state=open]:hidden" />
                            <Minus className="h-4 w-4 hidden group-data-[state=open]:block" />
                            <Check className="h-4 w-4 text-blue-500" />
                            Closed ({closedTasks.length})
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border rounded-md bg-muted/30 mt-1">
                              {closedTasks.map(task => (
                                <TaskRow
                                  key={task.id}
                                  task={task}
                                  allTasks={allTasks}
                                  projects={projects}
                                  people={people}
                                  onUpdate={handleUpdateTask}
                                  onDelete={handleDeleteTask}
                                  onCreateSubtask={(parentId, title, parsed) => handleCreateTask(title, parsed, parentId)}
                                  onIndent={handleIndent}
                                  onOutdent={handleOutdent}
                                  userEmail={userEmail}
                                  hideProjectBadge={true}
                                  showDetailsToggle={true}
                                  openTaskId={openTaskId}
                                  onOpenDetails={setOpenTaskId}
                                />
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}

            {filteredTasksWithoutAccount.length > 0 && (() => {
              const priorityOrder: Record<string, number> = { high: 2, medium: 1, normal: 0 };
              const sortByPriority = (tasks: Task[]) => 
                [...tasks].sort((a, b) => (priorityOrder[b.priority || 'normal'] || 0) - (priorityOrder[a.priority || 'normal'] || 0));
              
              const activeUnassigned = sortByPriority(filteredTasksWithoutAccount.filter(t => t.status === 'todo' || t.status === 'in-progress'));
              const blockedUnassigned = sortByPriority(filteredTasksWithoutAccount.filter(t => t.status === 'blocked'));
              const closedUnassigned = sortByPriority(filteredTasksWithoutAccount.filter(t => t.status === 'done'));
              
              return (
                <Collapsible defaultOpen={false}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded-lg hover-elevate text-left group">
                    <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                    <Circle className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm text-muted-foreground">Account unassigned/general</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {filteredTasksWithoutAccount.length}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border rounded-lg mt-2 bg-card space-y-2 p-2">
                      {activeUnassigned.length > 0 && (
                        <Collapsible defaultOpen={true}>
                          <CollapsibleTrigger className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-muted/50 hover:bg-muted w-full text-left group">
                            <Plus className="h-4 w-4 group-data-[state=open]:hidden" />
                            <Minus className="h-4 w-4 hidden group-data-[state=open]:block" />
                            <Play className="h-4 w-4 text-green-500 fill-green-500" />
                            To-do / In-progress ({activeUnassigned.length})
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border rounded-md bg-background mt-1">
                              {activeUnassigned.map(task => (
                                <TaskRow
                                  key={task.id}
                                  task={task}
                                  allTasks={allTasks}
                                  projects={projects}
                                  people={people}
                                  onUpdate={handleUpdateTask}
                                  onDelete={handleDeleteTask}
                                  onCreateSubtask={(parentId, title, parsed) => handleCreateTask(title, parsed, parentId)}
                                  onIndent={handleIndent}
                                  onOutdent={handleOutdent}
                                  userEmail={userEmail}
                                  hideProjectBadge={true}
                                  showDetailsToggle={true}
                                  openTaskId={openTaskId}
                                  onOpenDetails={setOpenTaskId}
                                />
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                      
                      {blockedUnassigned.length > 0 && (
                        <Collapsible defaultOpen={true}>
                          <CollapsibleTrigger className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-muted/50 hover:bg-muted w-full text-left group">
                            <Plus className="h-4 w-4 group-data-[state=open]:hidden" />
                            <Minus className="h-4 w-4 hidden group-data-[state=open]:block" />
                            <Ban className="h-4 w-4 text-red-500" />
                            Blockers ({blockedUnassigned.length})
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border rounded-md mt-1">
                              {blockedUnassigned.map(task => (
                                <TaskRow
                                  key={task.id}
                                  task={task}
                                  allTasks={allTasks}
                                  projects={projects}
                                  people={people}
                                  onUpdate={handleUpdateTask}
                                  onDelete={handleDeleteTask}
                                  onCreateSubtask={(parentId, title, parsed) => handleCreateTask(title, parsed, parentId)}
                                  onIndent={handleIndent}
                                  onOutdent={handleOutdent}
                                  userEmail={userEmail}
                                  hideProjectBadge={true}
                                  showDetailsToggle={true}
                                  openTaskId={openTaskId}
                                  onOpenDetails={setOpenTaskId}
                                />
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                      
                      {closedUnassigned.length > 0 && (
                        <Collapsible defaultOpen={false}>
                          <CollapsibleTrigger className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-muted/50 hover:bg-muted w-full text-left group">
                            <Plus className="h-4 w-4 group-data-[state=open]:hidden" />
                            <Minus className="h-4 w-4 hidden group-data-[state=open]:block" />
                            <Check className="h-4 w-4 text-blue-500" />
                            Closed ({closedUnassigned.length})
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border rounded-md bg-muted/30 mt-1">
                              {closedUnassigned.map(task => (
                                <TaskRow
                                  key={task.id}
                                  task={task}
                                  allTasks={allTasks}
                                  projects={projects}
                                  people={people}
                                  onUpdate={handleUpdateTask}
                                  onDelete={handleDeleteTask}
                                  onCreateSubtask={(parentId, title, parsed) => handleCreateTask(title, parsed, parentId)}
                                  onIndent={handleIndent}
                                  onOutdent={handleOutdent}
                                  userEmail={userEmail}
                                  hideProjectBadge={true}
                                  showDetailsToggle={true}
                                  openTaskId={openTaskId}
                                  onOpenDetails={setOpenTaskId}
                                />
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
