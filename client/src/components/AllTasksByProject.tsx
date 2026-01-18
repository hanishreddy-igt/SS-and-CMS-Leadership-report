import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { 
  ChevronDown, 
  ChevronRight, 
  FolderKanban,
  Circle,
  Play,
  Check,
  Ban
} from 'lucide-react';
import type { Task, Project, Person } from '@shared/schema';
import { TaskRow, ParsedTitle, parseInlineTags } from './WorkingSpace';

export default function AllTasksByProject() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [leadFilter, setLeadFilter] = useState<string>('all');

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
      const matchedProject = projects.find(p => 
        p.name.toLowerCase().replace(/\s+/g, '').includes(parsed.projectTag!.toLowerCase()) ||
        p.name.toLowerCase().includes(parsed.projectTag!.toLowerCase())
      );
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
    return people.filter(p => leadIds.has(p.id));
  }, [projects, people]);

  const projectsWithTasks = projects.filter(p => {
    const hasTasks = allTasks.some(t => t.projectId === p.id);
    if (!hasTasks) return false;
    if (leadFilter === 'all') return true;
    return p.leadId === leadFilter || (p.leadIds && p.leadIds.includes(leadFilter));
  });

  const tasksWithoutProject = allTasks.filter(t => !t.projectId && !t.parentTaskId);

  if (tasksLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Card data-testid="all-tasks-section">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FolderKanban className="h-5 w-5" />
            All Tasks by Project
          </CardTitle>
          <Select value={leadFilter} onValueChange={setLeadFilter}>
            <SelectTrigger className="w-[200px] h-8" data-testid="lead-filter">
              <SelectValue placeholder="Filter by Lead" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Leads</SelectItem>
              {projectLeads.map(lead => (
                <SelectItem key={lead.id} value={lead.id}>{lead.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {projectsWithTasks.length === 0 && tasksWithoutProject.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <FolderKanban className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p>No team tasks yet. Tasks from all team members will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {projectsWithTasks.map(project => {
              const priorityOrder: Record<string, number> = { high: 2, medium: 1, normal: 0 };
              const sortByPriority = (tasks: Task[]) => 
                [...tasks].sort((a, b) => (priorityOrder[b.priority || 'normal'] || 0) - (priorityOrder[a.priority || 'normal'] || 0));
              
              const projectTasks = allTasks.filter(t => t.projectId === project.id && !t.parentTaskId);
              const activeTasks = sortByPriority(projectTasks.filter(t => t.status === 'todo' || t.status === 'in-progress'));
              const blockedTasks = sortByPriority(projectTasks.filter(t => t.status === 'blocked'));
              const closedTasks = sortByPriority(projectTasks.filter(t => t.status === 'done'));
              
              return (
                <Collapsible key={project.id} defaultOpen>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded-lg hover-elevate text-left">
                    <ChevronDown className="h-4 w-4" />
                    <FolderKanban className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">{project.name}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {projectTasks.length}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border rounded-lg mt-2 bg-card space-y-2 p-2">
                      {activeTasks.length > 0 && (
                        <Collapsible defaultOpen={true}>
                          <CollapsibleTrigger className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground w-full text-left">
                            <ChevronRight className="h-3 w-3" />
                            <Play className="h-3 w-3" />
                            To-do / In-progress ({activeTasks.length})
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border rounded-md bg-background">
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
                                />
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                      
                      {blockedTasks.length > 0 && (
                        <Collapsible defaultOpen={true}>
                          <CollapsibleTrigger className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground w-full text-left">
                            <ChevronRight className="h-3 w-3" />
                            <Ban className="h-3 w-3 text-red-500" />
                            Blockers ({blockedTasks.length})
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border rounded-md">
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
                                />
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                      
                      {closedTasks.length > 0 && (
                        <Collapsible defaultOpen={false}>
                          <CollapsibleTrigger className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground w-full text-left">
                            <ChevronRight className="h-3 w-3" />
                            <Check className="h-3 w-3" />
                            Closed ({closedTasks.length})
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border rounded-md bg-muted/30">
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

            {tasksWithoutProject.length > 0 && (() => {
              const priorityOrder: Record<string, number> = { high: 2, medium: 1, normal: 0 };
              const sortByPriority = (tasks: Task[]) => 
                [...tasks].sort((a, b) => (priorityOrder[b.priority || 'normal'] || 0) - (priorityOrder[a.priority || 'normal'] || 0));
              
              const activeUnassigned = sortByPriority(tasksWithoutProject.filter(t => t.status === 'todo' || t.status === 'in-progress'));
              const blockedUnassigned = sortByPriority(tasksWithoutProject.filter(t => t.status === 'blocked'));
              const closedUnassigned = sortByPriority(tasksWithoutProject.filter(t => t.status === 'done'));
              
              return (
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded-lg hover-elevate text-left">
                    <ChevronDown className="h-4 w-4" />
                    <Circle className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm text-muted-foreground">Project unassigned/general</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {tasksWithoutProject.length}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border rounded-lg mt-2 bg-card space-y-2 p-2">
                      {activeUnassigned.length > 0 && (
                        <Collapsible defaultOpen={true}>
                          <CollapsibleTrigger className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground w-full text-left">
                            <ChevronRight className="h-3 w-3" />
                            <Play className="h-3 w-3" />
                            To-do / In-progress ({activeUnassigned.length})
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border rounded-md bg-background">
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
                                />
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                      
                      {blockedUnassigned.length > 0 && (
                        <Collapsible defaultOpen={true}>
                          <CollapsibleTrigger className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground w-full text-left">
                            <ChevronRight className="h-3 w-3" />
                            <Ban className="h-3 w-3 text-red-500" />
                            Blockers ({blockedUnassigned.length})
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border rounded-md">
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
                                />
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                      
                      {closedUnassigned.length > 0 && (
                        <Collapsible defaultOpen={false}>
                          <CollapsibleTrigger className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground w-full text-left">
                            <ChevronRight className="h-3 w-3" />
                            <Check className="h-3 w-3" />
                            Closed ({closedUnassigned.length})
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border rounded-md bg-muted/30">
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
