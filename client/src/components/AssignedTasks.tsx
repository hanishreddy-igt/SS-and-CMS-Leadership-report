import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { 
  ChevronDown, 
  ChevronRight, 
  Trash2, 
  Edit2, 
  Save, 
  X,
  FolderKanban,
  User,
  Tag,
  MessageSquare,
  AlertCircle,
  Clock,
  UserCheck
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
  const creator = people.find(p => p.email === task.createdBy);

  const handleSave = () => {
    onUpdate(task.id, { title: editTitle });
    setIsEditing(false);
  };

  const handleStatusChange = (status: string) => {
    onUpdate(task.id, { status: status as Task['status'] });
  };

  const handleToggleComplete = () => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    onUpdate(task.id, { status: newStatus });
  };

  return (
    <div 
      className="group"
      style={{ marginLeft: depth > 0 ? `${depth * 24}px` : 0 }}
      data-testid={`assigned-task-item-${task.id}`}
    >
      <div className="flex items-start gap-2 py-2 px-3 rounded-lg hover-elevate transition-colors">
        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
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
          <Checkbox
            checked={task.status === 'done'}
            onCheckedChange={handleToggleComplete}
            data-testid={`assigned-checkbox-${task.id}`}
          />
        </div>

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="h-8 flex-1"
                data-testid={`edit-assigned-title-${task.id}`}
              />
              <Button size="sm" onClick={handleSave}>
                <Save className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span 
                  className={`text-sm ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}
                  data-testid={`assigned-task-title-${task.id}`}
                >
                  {task.title}
                </span>
                <div className={`w-2 h-2 rounded-full ${statusColors[task.status]}`} title={task.status} />
                {task.priority && task.priority !== 'medium' && (
                  <AlertCircle className={`h-3 w-3 ${priorityColors[task.priority]}`} />
                )}
              </div>
              {task.description && (
                <p className="text-xs text-muted-foreground line-clamp-1">{task.description}</p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {project && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <FolderKanban className="h-3 w-3" />
                    {project.name}
                  </Badge>
                )}
                {creator && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <User className="h-3 w-3" />
                    Created by: {creator.name || task.createdBy}
                  </Badge>
                )}
                {task.dueDate && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(task.dueDate).toLocaleDateString()}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Select value={task.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-7 w-24 text-xs" data-testid={`assigned-status-${task.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsEditing(true)}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={() => onDelete(task.id)}
            data-testid={`delete-assigned-${task.id}`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
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

  const todoTasks = assignedTasks.filter(t => t.status === 'todo' && !t.parentTaskId);
  const inProgressTasks = assignedTasks.filter(t => t.status === 'in-progress' && !t.parentTaskId);
  const blockedTasks = assignedTasks.filter(t => t.status === 'blocked' && !t.parentTaskId);
  const doneTasks = assignedTasks.filter(t => t.status === 'done' && !t.parentTaskId);

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
          <span className="w-2 h-2 rounded-full bg-slate-500" />
          To Do: {todoTasks.length}
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          In Progress: {inProgressTasks.length}
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          Blocked: {blockedTasks.length}
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Done: {doneTasks.length}
        </Badge>
      </div>

      {todoTasks.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-slate-500" />
              To Do ({todoTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {todoTasks.map(task => (
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

      {inProgressTasks.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              In Progress ({inProgressTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {inProgressTasks.map(task => (
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
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              Blocked ({blockedTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
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

      {doneTasks.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500" />
              Done ({doneTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {doneTasks.map(task => (
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
    </div>
  );
}
