import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
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
  Check,
  Clock
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
  onAddSubtask: (parentId: string) => void;
  depth?: number;
}

function TaskItem({ 
  task, 
  allTasks, 
  projects, 
  people, 
  onUpdate, 
  onDelete, 
  onAddSubtask,
  depth = 0 
}: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(task.isExpanded === 'true');
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description || '');

  const subtasks = allTasks.filter(t => t.parentTaskId === task.id);
  const hasSubtasks = subtasks.length > 0;
  const project = task.projectId ? projects.find(p => p.id === task.projectId) : null;
  const assignees = people.filter(p => task.assignedTo.includes(p.id));

  const handleSave = () => {
    onUpdate(task.id, { title: editTitle, description: editDescription });
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
      data-testid={`task-item-${task.id}`}
    >
      <div className="flex items-start gap-2 py-2 px-3 rounded-lg hover-elevate transition-colors">
        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
          {hasSubtasks ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => setIsExpanded(!isExpanded)}
              data-testid={`toggle-expand-${task.id}`}
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
          ) : (
            <div className="w-5" />
          )}
          <Checkbox
            checked={task.status === 'done'}
            onCheckedChange={handleToggleComplete}
            data-testid={`task-checkbox-${task.id}`}
          />
        </div>

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-2">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="h-8"
                data-testid={`edit-task-title-${task.id}`}
              />
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Add description..."
                className="min-h-[60px]"
                data-testid={`edit-task-description-${task.id}`}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} data-testid={`save-task-${task.id}`}>
                  <Save className="h-3 w-3 mr-1" /> Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} data-testid={`cancel-edit-${task.id}`}>
                  <X className="h-3 w-3 mr-1" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span 
                  className={`text-sm ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}
                  data-testid={`task-title-${task.id}`}
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
                {assignees.map(person => (
                  <Badge key={person.id} variant="secondary" className="text-xs gap-1">
                    <User className="h-3 w-3" />
                    {person.name}
                  </Badge>
                ))}
                {task.tags.length > 0 && task.tags.map((tag, i) => (
                  <Badge key={i} variant="outline" className="text-xs gap-1">
                    <Tag className="h-3 w-3" />
                    {tag}
                  </Badge>
                ))}
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
            <SelectTrigger className="h-7 w-24 text-xs" data-testid={`status-select-${task.id}`}>
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
            onClick={() => onAddSubtask(task.id)}
            data-testid={`add-subtask-${task.id}`}
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsEditing(true)}
            data-testid={`edit-task-btn-${task.id}`}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={() => onDelete(task.id)}
            data-testid={`delete-task-${task.id}`}
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
              onAddSubtask={onAddSubtask}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TaskFormProps {
  projects: Project[];
  people: Person[];
  parentTaskId?: string | null;
  onSubmit: (task: { title: string; description?: string; projectId?: string; parentTaskId?: string; assignedTo?: string[]; priority?: string }) => void;
  onCancel?: () => void;
}

function TaskForm({ projects, people, parentTaskId, onSubmit, onCancel }: TaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [priority, setPriority] = useState('medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      projectId: projectId || undefined,
      parentTaskId: parentTaskId || undefined,
      assignedTo,
      priority,
    });
    
    setTitle('');
    setDescription('');
    setProjectId('');
    setAssignedTo([]);
    setPriority('medium');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs to be done?"
        className="text-sm"
        autoFocus
        data-testid="new-task-title"
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="h-8 text-xs" data-testid="new-task-project">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">No Project</SelectItem>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="h-8 text-xs" data-testid="new-task-priority">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Add details... (optional)"
        className="min-h-[60px] text-sm"
        data-testid="new-task-description"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" data-testid="submit-new-task">
          <Plus className="h-4 w-4 mr-1" /> Add Task
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} data-testid="cancel-new-task">
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export default function WorkingSpace() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [addingSubtaskTo, setAddingSubtaskTo] = useState<string | null>(null);

  const { data: allTasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ['/api/tasks'],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const { data: people = [] } = useQuery<Person[]>({
    queryKey: ['/api/people'],
  });

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: Partial<Task>) => {
      const res = await apiRequest('POST', '/api/tasks', taskData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({ title: 'Task created', description: 'Your task has been added.' });
      setAddingSubtaskTo(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
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
  const myTasks = allTasks.filter(t => t.createdBy === userEmail);
  const rootTasks = myTasks.filter(t => !t.parentTaskId);

  const handleCreateTask = (taskData: Partial<Task>) => {
    createTaskMutation.mutate(taskData);
  };

  const handleUpdateTask = (id: string, updates: Partial<Task>) => {
    updateTaskMutation.mutate({ id, updates });
  };

  const handleDeleteTask = (id: string) => {
    deleteTaskMutation.mutate(id);
  };

  const handleAddSubtask = (parentId: string) => {
    setAddingSubtaskTo(parentId);
  };

  const projectsWithTasks = projects.filter(p => 
    allTasks.some(t => t.projectId === p.id)
  );

  const tasksWithoutProject = allTasks.filter(t => !t.projectId && !t.parentTaskId);

  if (tasksLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card data-testid="your-workspace-section">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Your Workspace
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TaskForm 
            projects={projects} 
            people={people} 
            onSubmit={handleCreateTask}
          />
          
          <Separator />
          
          {rootTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No tasks yet. Create your first task above!</p>
            </div>
          ) : (
            <div className="space-y-1">
              {rootTasks.map(task => (
                <div key={task.id}>
                  <TaskItem
                    task={task}
                    allTasks={myTasks}
                    projects={projects}
                    people={people}
                    onUpdate={handleUpdateTask}
                    onDelete={handleDeleteTask}
                    onAddSubtask={handleAddSubtask}
                  />
                  {addingSubtaskTo === task.id && (
                    <div className="ml-12 mt-2 p-3 bg-muted/50 rounded-lg">
                      <TaskForm
                        projects={projects}
                        people={people}
                        parentTaskId={task.id}
                        onSubmit={handleCreateTask}
                        onCancel={() => setAddingSubtaskTo(null)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="all-tasks-section">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5" />
            All Tasks by Project
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projectsWithTasks.length === 0 && tasksWithoutProject.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderKanban className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No team tasks yet. Tasks from all team members will appear here organized by project.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {projectsWithTasks.map(project => {
                const projectTasks = allTasks.filter(t => t.projectId === project.id && !t.parentTaskId);
                return (
                  <Collapsible key={project.id} defaultOpen>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded-lg hover-elevate text-left">
                      <ChevronDown className="h-4 w-4" />
                      <FolderKanban className="h-4 w-4 text-primary" />
                      <span className="font-medium">{project.name}</span>
                      <Badge variant="secondary" className="ml-auto">{projectTasks.length}</Badge>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      {projectTasks.map(task => (
                        <div key={task.id}>
                          <TaskItem
                            task={task}
                            allTasks={allTasks}
                            projects={projects}
                            people={people}
                            onUpdate={handleUpdateTask}
                            onDelete={handleDeleteTask}
                            onAddSubtask={handleAddSubtask}
                          />
                          {addingSubtaskTo === task.id && (
                            <div className="ml-12 mt-2 p-3 bg-muted/50 rounded-lg">
                              <TaskForm
                                projects={projects}
                                people={people}
                                parentTaskId={task.id}
                                onSubmit={handleCreateTask}
                                onCancel={() => setAddingSubtaskTo(null)}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}

              {tasksWithoutProject.length > 0 && (
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded-lg hover-elevate text-left">
                    <ChevronDown className="h-4 w-4" />
                    <FolderKanban className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-muted-foreground">Unassigned</span>
                    <Badge variant="secondary" className="ml-auto">{tasksWithoutProject.length}</Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    {tasksWithoutProject.map(task => (
                      <div key={task.id}>
                        <TaskItem
                          task={task}
                          allTasks={allTasks}
                          projects={projects}
                          people={people}
                          onUpdate={handleUpdateTask}
                          onDelete={handleDeleteTask}
                          onAddSubtask={handleAddSubtask}
                        />
                        {addingSubtaskTo === task.id && (
                          <div className="ml-12 mt-2 p-3 bg-muted/50 rounded-lg">
                            <TaskForm
                              projects={projects}
                              people={people}
                              parentTaskId={task.id}
                              onSubmit={handleCreateTask}
                              onCancel={() => setAddingSubtaskTo(null)}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
