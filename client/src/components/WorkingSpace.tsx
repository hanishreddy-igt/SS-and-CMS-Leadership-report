import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  ChevronDown, 
  ChevronRight, 
  Trash2,
  FolderKanban,
  User,
  MessageSquare,
  Circle
} from 'lucide-react';
import type { Task, Project, Person } from '@shared/schema';

const statusColors: Record<string, string> = {
  todo: 'bg-slate-500',
  'in-progress': 'bg-blue-500',
  blocked: 'bg-red-500',
  done: 'bg-green-500',
};

interface InlineTaskInputProps {
  onSubmit: (title: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  depth?: number;
}

function InlineTaskInput({ onSubmit, placeholder = "Type a task and press Enter...", autoFocus = false, depth = 0 }: InlineTaskInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim()) {
      onSubmit(value.trim());
      setValue('');
    }
    if (e.key === 'Escape') {
      setValue('');
    }
  };

  return (
    <div 
      className="flex items-center gap-2 py-1.5"
      style={{ paddingLeft: depth > 0 ? `${depth * 24 + 8}px` : '8px' }}
    >
      <Circle className="h-3 w-3 text-muted-foreground/40" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm h-8 px-1"
        data-testid="inline-task-input"
      />
    </div>
  );
}

interface TaskRowProps {
  task: Task;
  allTasks: Task[];
  projects: Project[];
  people: Person[];
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onCreateSubtask: (parentId: string, title: string) => void;
  depth?: number;
}

function TaskRow({ 
  task, 
  allTasks, 
  projects, 
  people, 
  onUpdate, 
  onDelete, 
  onCreateSubtask,
  depth = 0 
}: TaskRowProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const subtasks = allTasks.filter(t => t.parentTaskId === task.id);
  const hasSubtasks = subtasks.length > 0;
  const project = task.projectId ? projects.find(p => p.id === task.projectId) : null;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleToggleComplete = () => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    onUpdate(task.id, { status: newStatus });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (editValue.trim()) {
        onUpdate(task.id, { title: editValue.trim() });
      }
      setIsEditing(false);
    }
    if (e.key === 'Escape') {
      setEditValue(task.title);
      setIsEditing(false);
    }
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      setShowSubtaskInput(true);
    }
  };

  const handleSubtaskCreate = (title: string) => {
    onCreateSubtask(task.id, title);
    setShowSubtaskInput(false);
  };

  return (
    <div data-testid={`task-row-${task.id}`}>
      <div 
        className="group flex items-center gap-2 py-1.5 rounded hover-elevate"
        style={{ paddingLeft: depth > 0 ? `${depth * 24 + 8}px` : '8px' }}
      >
        <div className="flex items-center gap-1 flex-shrink-0">
          {hasSubtasks ? (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-0.5 hover:bg-accent rounded"
              data-testid={`toggle-${task.id}`}
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          ) : (
            <div className="w-4" />
          )}
          <Checkbox
            checked={task.status === 'done'}
            onCheckedChange={handleToggleComplete}
            className="h-4 w-4"
            data-testid={`checkbox-${task.id}`}
          />
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          {isEditing ? (
            <Input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                if (editValue.trim() && editValue !== task.title) {
                  onUpdate(task.id, { title: editValue.trim() });
                }
                setIsEditing(false);
              }}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm h-7 px-1"
            />
          ) : (
            <span 
              className={`text-sm cursor-text flex-1 ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}
              onClick={() => setIsEditing(true)}
              data-testid={`task-title-${task.id}`}
            >
              {task.title}
            </span>
          )}
          
          {project && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
              {project.name}
            </Badge>
          )}
          
          <div className={`w-2 h-2 rounded-full ${statusColors[task.status] || statusColors.todo}`} />
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setShowSubtaskInput(true)}
            data-testid={`add-subtask-${task.id}`}
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive"
            onClick={() => onDelete(task.id)}
            data-testid={`delete-${task.id}`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {isExpanded && hasSubtasks && (
        <div>
          {subtasks.map(subtask => (
            <TaskRow
              key={subtask.id}
              task={subtask}
              allTasks={allTasks}
              projects={projects}
              people={people}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onCreateSubtask={onCreateSubtask}
              depth={depth + 1}
            />
          ))}
        </div>
      )}

      {showSubtaskInput && (
        <InlineTaskInput
          onSubmit={handleSubtaskCreate}
          placeholder="Add sub-task..."
          autoFocus
          depth={depth + 1}
        />
      )}
    </div>
  );
}

export default function WorkingSpace() {
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

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: Partial<Task>) => {
      const res = await apiRequest('POST', '/api/tasks', taskData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
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
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const userEmail = user?.email || '';
  const myTasks = allTasks.filter(t => t.createdBy === userEmail);
  const myRootTasks = myTasks.filter(t => !t.parentTaskId);

  const handleCreateTask = (title: string, parentTaskId?: string) => {
    createTaskMutation.mutate({ 
      title, 
      parentTaskId: parentTaskId || undefined,
      status: 'todo',
      priority: 'medium',
      assignedTo: [],
    });
  };

  const handleUpdateTask = (id: string, updates: Partial<Task>) => {
    updateTaskMutation.mutate({ id, updates });
  };

  const handleDeleteTask = (id: string) => {
    deleteTaskMutation.mutate(id);
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
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5" />
            Your Workspace
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg bg-card">
            <InlineTaskInput 
              onSubmit={(title) => handleCreateTask(title)} 
              placeholder="Type a task and press Enter..."
              autoFocus
            />
            
            {myRootTasks.length > 0 && (
              <div className="border-t">
                {myRootTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    allTasks={myTasks}
                    projects={projects}
                    people={people}
                    onUpdate={handleUpdateTask}
                    onDelete={handleDeleteTask}
                    onCreateSubtask={(parentId, title) => handleCreateTask(title, parentId)}
                  />
                ))}
              </div>
            )}
            
            {myRootTasks.length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm border-t">
                <MessageSquare className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p>No tasks yet. Type above to create your first task.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="all-tasks-section">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FolderKanban className="h-5 w-5" />
            All Tasks by Project
          </CardTitle>
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
                const projectTasks = allTasks.filter(t => t.projectId === project.id && !t.parentTaskId);
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
                      <div className="border rounded-lg mt-2 bg-card">
                        {projectTasks.map(task => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            allTasks={allTasks}
                            projects={projects}
                            people={people}
                            onUpdate={handleUpdateTask}
                            onDelete={handleDeleteTask}
                            onCreateSubtask={(parentId, title) => handleCreateTask(title, parentId)}
                          />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}

              {tasksWithoutProject.length > 0 && (
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded-lg hover-elevate text-left">
                    <ChevronDown className="h-4 w-4" />
                    <Circle className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm text-muted-foreground">No Project</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {tasksWithoutProject.length}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border rounded-lg mt-2 bg-card">
                      {tasksWithoutProject.map(task => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          allTasks={allTasks}
                          projects={projects}
                          people={people}
                          onUpdate={handleUpdateTask}
                          onDelete={handleDeleteTask}
                          onCreateSubtask={(parentId, title) => handleCreateTask(title, parentId)}
                        />
                      ))}
                    </div>
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
