import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { 
  ChevronDown, 
  ChevronRight, 
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
  const [isClosedExpanded, setIsClosedExpanded] = useState(false);

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

  const activeTasks = assignedTasks.filter(t => 
    (t.status === 'todo' || t.status === 'in-progress') && !t.parentTaskId
  );
  const blockedTasks = assignedTasks.filter(t => t.status === 'blocked' && !t.parentTaskId);
  const closedTasks = assignedTasks.filter(t => t.status === 'done' && !t.parentTaskId);

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
    <div className="space-y-4" data-testid="assigned-tasks-section">
      <div className="flex items-center gap-4 flex-wrap">
        <Badge variant="secondary" className="gap-1">
          <Circle className="h-3 w-3 text-slate-400" />
          <Play className="h-3 w-3 text-blue-500 fill-blue-500" />
          Active: {activeTasks.length}
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <Ban className="h-3 w-3 text-red-500" />
          Blockers: {blockedTasks.length}
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <Check className="h-3 w-3 text-green-500" />
          Closed: {closedTasks.length}
        </Badge>
      </div>

      {activeTasks.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Circle className="h-4 w-4 text-slate-400" />
              <Play className="h-4 w-4 text-blue-500 fill-blue-500" />
              To-do / In-progress ({activeTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
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
              />
            ))}
          </CardContent>
        </Card>
      )}

      {blockedTasks.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Ban className="h-4 w-4 text-red-500" />
              Blockers ({blockedTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
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
              />
            ))}
          </CardContent>
        </Card>
      )}

      {closedTasks.length > 0 && (
        <Collapsible open={isClosedExpanded} onOpenChange={setIsClosedExpanded}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="py-3 cursor-pointer hover-elevate rounded-lg">
                <CardTitle className="text-sm flex items-center gap-2">
                  {isClosedExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <Check className="h-4 w-4 text-green-500" />
                  Closed ({closedTasks.length})
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
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
                  />
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}
