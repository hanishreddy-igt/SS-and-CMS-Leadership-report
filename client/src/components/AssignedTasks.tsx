import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { 
  ChevronDown, 
  ChevronRight, 
  Trash2, 
  MoreHorizontal,
  Save, 
  X,
  FolderKanban,
  MessageSquare,
  AlertCircle,
  Clock,
  UserCheck,
  Circle,
  Play,
  Check,
  Ban,
  StickyNote
} from 'lucide-react';
import type { Task, Project, Person } from '@shared/schema';

const statusColors: Record<string, string> = {
  todo: 'bg-slate-500',
  'in-progress': 'bg-blue-500',
  blocked: 'bg-red-500',
  done: 'bg-green-500',
};

const priorityColors: Record<string, string> = {
  low: 'text-slate-500',
  medium: 'text-yellow-500',
  high: 'text-orange-500',
  urgent: 'text-red-500',
};

const STATUS_CYCLE = ['todo', 'in-progress', 'done'];

function StatusIcon({ status, onClick, taskId }: { status: string; onClick: () => void; taskId?: string }) {
  const iconClass = "h-4 w-4 cursor-pointer transition-colors";
  const testId = taskId ? `status-${taskId}` : 'status-icon';
  
  switch (status) {
    case 'todo':
      return (
        <button 
          onClick={onClick} 
          className="p-0.5 hover:bg-accent rounded" 
          title="To Do - Click to change"
          aria-label="Status: To Do. Click to change to In Progress"
          data-testid={testId}
        >
          <Circle className={`${iconClass} text-slate-400`} />
        </button>
      );
    case 'in-progress':
      return (
        <button 
          onClick={onClick} 
          className="p-0.5 hover:bg-accent rounded" 
          title="In Progress - Click to mark done"
          aria-label="Status: In Progress. Click to change to Done"
          data-testid={testId}
        >
          <Play className={`${iconClass} text-blue-500 fill-blue-500`} />
        </button>
      );
    case 'blocked':
      return (
        <div 
          className="p-0.5" 
          title="Blocked"
          data-testid={testId}
        >
          <Ban className="h-4 w-4 text-red-500" />
        </div>
      );
    case 'done':
      return (
        <div 
          className="p-0.5" 
          title="Done"
          data-testid={testId}
        >
          <Check className="h-4 w-4 text-green-500" />
        </div>
      );
    default:
      return (
        <button 
          onClick={onClick} 
          className="p-0.5 hover:bg-accent rounded" 
          title="Click to change status"
          data-testid={testId}
        >
          <Circle className={`${iconClass} text-slate-400`} />
        </button>
      );
  }
}

interface TaskItemProps {
  task: Task;
  allTasks: Task[];
  projects: Project[];
  people: Person[];
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  depth?: number;
}

function TaskItem({ 
  task, 
  allTasks, 
  projects, 
  people, 
  onUpdate, 
  onDelete,
  depth = 0 
}: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(task.isExpanded === 'true');
  const [editTitle, setEditTitle] = useState(task.title);

  const subtasks = allTasks.filter(t => t.parentTaskId === task.id);
  const hasSubtasks = subtasks.length > 0;
  const project = task.projectId ? projects.find(p => p.id === task.projectId) : null;
  const assignees = people.filter(p => task.assignedTo.includes(p.id));
  const noteCount = task.notes?.length || 0;
  
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';

  const handleSave = () => {
    onUpdate(task.id, { title: editTitle });
    setIsEditing(false);
  };

  const handleCycleStatus = () => {
    if (task.status === 'done' || task.status === 'blocked') return;
    
    const currentIndex = STATUS_CYCLE.indexOf(task.status);
    const nextIndex = currentIndex + 1;
    if (nextIndex < STATUS_CYCLE.length) {
      onUpdate(task.id, { status: STATUS_CYCLE[nextIndex] as Task['status'] });
    }
  };

  const handleStatusChange = (status: string) => {
    onUpdate(task.id, { status: status as Task['status'] });
  };

  return (
    <div 
      className="group"
      style={{ marginLeft: depth > 0 ? `${depth * 24}px` : 0 }}
      data-testid={`assigned-task-item-${task.id}`}
    >
      <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover-elevate transition-colors">
        <div className="flex items-center gap-1 flex-shrink-0">
          {hasSubtasks ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
          ) : (
            <div className="w-5" />
          )}
          <StatusIcon 
            status={task.status} 
            onClick={handleCycleStatus}
            taskId={task.id}
          />
        </div>

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="h-7 flex-1 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
                autoFocus
                data-testid={`edit-assigned-title-${task.id}`}
              />
              <Button size="icon" className="h-6 w-6" onClick={handleSave}>
                <Save className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsEditing(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span 
                className={`text-sm ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}
                onDoubleClick={() => setIsEditing(true)}
                data-testid={`assigned-task-title-${task.id}`}
              >
                {task.title}
              </span>
              {task.priority && task.priority !== 'medium' && (
                <AlertCircle className={`h-3 w-3 ${priorityColors[task.priority]}`} />
              )}
              {project && (
                <Badge variant="outline" className="text-xs gap-1 h-5">
                  <FolderKanban className="h-3 w-3" />
                  {project.name}
                </Badge>
              )}
              {assignees.length > 0 && (
                <Badge variant="secondary" className="text-xs gap-1 h-5">
                  {assignees.map(a => a.name).join(', ')}
                </Badge>
              )}
              {task.dueDate && (
                <Badge 
                  variant={isOverdue ? "destructive" : "outline"} 
                  className="text-xs gap-1 h-5"
                >
                  <Clock className="h-3 w-3" />
                  {new Date(task.dueDate).toLocaleDateString()}
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title={`${noteCount} note${noteCount !== 1 ? 's' : ''}`}
          >
            <StickyNote className={`h-3 w-3 ${noteCount > 0 ? 'text-amber-500' : ''}`} />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                data-testid={`assigned-menu-${task.id}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                Edit Title
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleStatusChange('todo')}>
                <Circle className="h-3 w-3 mr-2 text-slate-400" />
                Set To Do
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('in-progress')}>
                <Play className="h-3 w-3 mr-2 text-blue-500 fill-blue-500" />
                Set In Progress
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('blocked')}>
                <Ban className="h-3 w-3 mr-2 text-red-500" />
                Set Blocked
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('done')}>
                <Check className="h-3 w-3 mr-2 text-green-500" />
                Set Done
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onDelete(task.id)}
                className="text-destructive"
                data-testid={`delete-assigned-${task.id}`}
              >
                <Trash2 className="h-3 w-3 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {hasSubtasks && isExpanded && (
        <div className="border-l border-border ml-4">
          {subtasks.map(subtask => (
            <TaskItem
              key={subtask.id}
              task={subtask}
              allTasks={allTasks}
              projects={projects}
              people={people}
              onUpdate={onUpdate}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AssignedTasks() {
  const { user } = useAuth();
  const { toast } = useToast();

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
  
  const [isClosedExpanded, setIsClosedExpanded] = useState(false);

  const handleUpdateTask = (id: string, updates: Partial<Task>) => {
    updateTaskMutation.mutate({ id, updates });
  };

  const handleDeleteTask = (id: string) => {
    deleteTaskMutation.mutate(id);
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
        <Badge variant="secondary" className="gap-1 text-red-600">
          <Ban className="h-3 w-3" />
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
              <TaskItem
                key={task.id}
                task={task}
                allTasks={assignedTasks}
                projects={projects}
                people={people}
                onUpdate={handleUpdateTask}
                onDelete={handleDeleteTask}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {blockedTasks.length > 0 && (
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="py-3 bg-red-50 dark:bg-red-950/30 rounded-t-lg">
            <CardTitle className="text-sm flex items-center gap-2 text-red-700 dark:text-red-400">
              <Ban className="h-4 w-4" />
              Blockers ({blockedTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 bg-red-50/50 dark:bg-red-950/20 rounded-b-lg">
            {blockedTasks.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                allTasks={assignedTasks}
                projects={projects}
                people={people}
                onUpdate={handleUpdateTask}
                onDelete={handleDeleteTask}
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
                  <TaskItem
                    key={task.id}
                    task={task}
                    allTasks={assignedTasks}
                    projects={projects}
                    people={people}
                    onUpdate={handleUpdateTask}
                    onDelete={handleDeleteTask}
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
