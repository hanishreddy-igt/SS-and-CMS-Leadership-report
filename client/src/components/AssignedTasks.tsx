import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus,
  Minus,
  MessageSquare,
  UserCheck,
  Circle,
  Play,
  Check,
  Ban
} from 'lucide-react';
import type { Task, Project, Person } from '@shared/schema';
import { TaskRow, ParsedTitle, parseInlineTags } from './WorkingSpace';

export default function AssignedTasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isActiveExpanded, setIsActiveExpanded] = useState(true);
  const [isBlockedExpanded, setIsBlockedExpanded] = useState(true);
  const [isClosedExpanded, setIsClosedExpanded] = useState(false);
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
  
  const matchingPeople = people.filter(p => p.email === userEmail);
  const myPersonIds = matchingPeople.map(p => p.id);
  const assignedTasks = myPersonIds.length > 0
    ? allTasks.filter(t => t.assignedTo?.some(id => myPersonIds.includes(id)))
    : [];

  const priorityOrder: Record<string, number> = { high: 2, medium: 1, normal: 0 };
  const sortByPriority = (tasks: Task[]) => 
    [...tasks].sort((a, b) => (priorityOrder[b.priority || 'normal'] || 0) - (priorityOrder[a.priority || 'normal'] || 0));

  const activeTasks = sortByPriority(assignedTasks.filter(t => 
    (t.status === 'todo' || t.status === 'in-progress') && !t.parentTaskId
  ));
  const blockedTasks = sortByPriority(assignedTasks.filter(t => t.status === 'blocked' && !t.parentTaskId));
  const closedTasks = sortByPriority(assignedTasks.filter(t => t.status === 'done' && !t.parentTaskId));

  const handleUpdateTask = (id: string, updates: Partial<Task>) => {
    updateTaskMutation.mutate({ id, updates });
  };

  const handleDeleteTask = (id: string) => {
    deleteTaskMutation.mutate(id);
  };

  const handleCreateSubtask = (parentId: string, title: string, parsed: ParsedTitle) => {
    const parentTask = allTasks.find(t => t.id === parentId);
    
    let projectId = parentTask?.projectId || null;
    if (parsed.projectTag) {
      const matchedProject = projects.find(p => 
        p.name.toLowerCase().includes(parsed.projectTag!.toLowerCase())
      );
      if (matchedProject) projectId = matchedProject.id;
    }
    
    let assignedTo: string[] = [];
    if (parsed.personTags.length > 0) {
      assignedTo = parsed.personTags
        .map(tag => {
          const person = people.find(p => 
            p.name.toLowerCase().includes(tag.toLowerCase())
          );
          return person?.id;
        })
        .filter((id): id is string => id !== undefined);
    }
    
    const notes: { content: string; author: string; timestamp: string }[] = [];
    if (parsed.noteText) {
      notes.push({
        content: parsed.noteText,
        author: userEmail,
        timestamp: new Date().toISOString()
      });
    }
    
    createTaskMutation.mutate({
      title: parsed.text,
      status: (parsed.statusTag as Task['status']) || 'todo',
      priority: 'medium',
      projectId,
      assignedTo,
      notes,
      parentTaskId: parentId,
      createdBy: userEmail,
      isExpanded: 'true',
      tags: []
    });
  };

  if (tasksLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (matchingPeople.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <UserCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-medium mb-2">No Profile Found</h3>
          <p className="text-muted-foreground">
            Your email ({userEmail}) is not linked to a team member profile. 
            Ask an admin to add you as a team member to receive task assignments.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (assignedTasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-medium mb-2">No Tasks Assigned</h3>
          <p className="text-muted-foreground">
            You don't have any tasks assigned to you yet. Tasks assigned to your profile will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div ref={containerRef} className="space-y-4" data-testid="assigned-tasks-section">
      <div className="flex items-center gap-4 flex-wrap">
        <Badge variant="secondary" className="gap-1">
          <Circle className="h-3 w-3 text-slate-400" />
          <Play className="h-3 w-3 text-green-500 fill-green-500" />
          Active: {activeTasks.length}
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <Ban className="h-3 w-3 text-red-500" />
          Blockers: {blockedTasks.length}
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <Check className="h-3 w-3 text-blue-500" />
          Closed: {closedTasks.length}
        </Badge>
      </div>

      <div className="border rounded-lg bg-card space-y-8 p-4">
        {activeTasks.length > 0 && (
          <Collapsible open={isActiveExpanded} onOpenChange={setIsActiveExpanded}>
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
                    allTasks={assignedTasks}
                    projects={projects}
                    people={people}
                    onUpdate={handleUpdateTask}
                    onDelete={handleDeleteTask}
                    onCreateSubtask={handleCreateSubtask}
                    userEmail={userEmail}
                    hiddenAssigneeIds={myPersonIds}
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
          <Collapsible open={isBlockedExpanded} onOpenChange={setIsBlockedExpanded}>
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
                    allTasks={assignedTasks}
                    projects={projects}
                    people={people}
                    onUpdate={handleUpdateTask}
                    onDelete={handleDeleteTask}
                    onCreateSubtask={handleCreateSubtask}
                    userEmail={userEmail}
                    hiddenAssigneeIds={myPersonIds}
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
          <Collapsible open={isClosedExpanded} onOpenChange={setIsClosedExpanded}>
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
                    allTasks={assignedTasks}
                    projects={projects}
                    people={people}
                    onUpdate={handleUpdateTask}
                    onDelete={handleDeleteTask}
                    onCreateSubtask={handleCreateSubtask}
                    userEmail={userEmail}
                    hiddenAssigneeIds={myPersonIds}
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
    </div>
  );
}
