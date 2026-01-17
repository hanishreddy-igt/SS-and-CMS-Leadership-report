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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Play,
  FileStack,
  FolderKanban,
  RefreshCw,
  Clock,
  Users
} from 'lucide-react';
import type { TaskTemplate, Project, Person, SubTemplateItem } from '@shared/schema';

const recurrenceOptions = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
];

interface TemplateFormData {
  name: string;
  description: string;
  projectId: string;
  assignedTo: string[];
  assignmentMode: 'single' | 'per-person';
  subTemplates: SubTemplateItem[];
  taskItems: string;
  recurrence: string;
  isActive: boolean;
}

interface TemplateFormProps {
  initialData?: TemplateFormData;
  projects: Project[];
  people: Person[];
  onSubmit: (data: TemplateFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

function TemplateForm({ initialData, projects, people, onSubmit, onCancel, isSubmitting }: TemplateFormProps) {
  const [formData, setFormData] = useState<TemplateFormData>(initialData || {
    name: '',
    description: '',
    projectId: '',
    assignedTo: [],
    assignmentMode: 'single',
    subTemplates: [],
    taskItems: '',
    recurrence: '',
    isActive: true,
  });
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    // Filter out empty sub-task titles before submitting
    const cleanedData = {
      ...formData,
      subTemplates: formData.subTemplates.filter(sub => sub.title.trim())
    };
    onSubmit(cleanedData);
  };

  const togglePerson = (personId: string) => {
    setFormData(prev => ({
      ...prev,
      assignedTo: prev.assignedTo.includes(personId)
        ? prev.assignedTo.filter(id => id !== personId)
        : [...prev.assignedTo, personId]
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Deliverable Name (becomes task title)</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Weekly Team Sync"
          data-testid="template-name-input"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (informational)</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe what this deliverable is for..."
          rows={2}
          data-testid="template-description-input"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Project</Label>
          <Select 
            value={formData.projectId || "none"} 
            onValueChange={(v) => setFormData({ ...formData, projectId: v === "none" ? "" : v })}
          >
            <SelectTrigger data-testid="template-project-select">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No project</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Recurrence (label)</Label>
          <Select 
            value={formData.recurrence || "once"} 
            onValueChange={(v) => setFormData({ ...formData, recurrence: v === "once" ? "" : v })}
          >
            <SelectTrigger data-testid="template-recurrence-select">
              <SelectValue placeholder="How often?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="once">One-time</SelectItem>
              {recurrenceOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Assign to People</Label>
        <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
          {people.length === 0 ? (
            <p className="text-sm text-muted-foreground">No people available</p>
          ) : (
            people.map(person => (
              <div key={person.id} className="flex items-center gap-2">
                <Checkbox
                  id={`person-${person.id}`}
                  checked={formData.assignedTo.includes(person.id)}
                  onCheckedChange={() => togglePerson(person.id)}
                />
                <label 
                  htmlFor={`person-${person.id}`} 
                  className="text-sm cursor-pointer flex-1"
                >
                  {person.name}
                  {person.email && (
                    <span className="text-muted-foreground ml-1">({person.email})</span>
                  )}
                </label>
              </div>
            ))
          )}
        </div>
        {formData.assignedTo.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {formData.assignedTo.length} person(s) selected
          </p>
        )}
        {formData.assignedTo.length > 1 && (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-2">
            <Label className="text-sm font-medium">Assignment Mode</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="mode-single"
                  name="assignmentMode"
                  value="single"
                  checked={formData.assignmentMode === 'single'}
                  onChange={() => setFormData({ ...formData, assignmentMode: 'single' })}
                  className="h-4 w-4"
                />
                <label htmlFor="mode-single" className="text-sm cursor-pointer">
                  <span className="font-medium">One task</span>
                  <span className="text-muted-foreground"> - All {formData.assignedTo.length} people on the same task</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="mode-per-person"
                  name="assignmentMode"
                  value="per-person"
                  checked={formData.assignmentMode === 'per-person'}
                  onChange={() => setFormData({ ...formData, assignmentMode: 'per-person' })}
                  className="h-4 w-4"
                />
                <label htmlFor="mode-per-person" className="text-sm cursor-pointer">
                  <span className="font-medium">Separate tasks</span>
                  <span className="text-muted-foreground"> - Create {formData.assignedTo.length} individual tasks</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sub-tasks section */}
      <div className="space-y-2">
        <Label>Sub-tasks (created as child tasks)</Label>
        <div className="border rounded-md p-3 space-y-3">
          {formData.subTemplates.length > 0 && (
            <div className="space-y-2">
              {formData.subTemplates.map((sub, index) => (
                <div key={sub.id} className="flex items-center gap-2 group">
                  <span className="text-muted-foreground text-sm">{index + 1}.</span>
                  <Input
                    value={sub.title}
                    onChange={(e) => {
                      const updated = [...formData.subTemplates];
                      updated[index] = { ...sub, title: e.target.value };
                      setFormData({ ...formData, subTemplates: updated });
                    }}
                    className="flex-1 h-8"
                    placeholder="Sub-task title"
                    data-testid={`subtask-input-${index}`}
                  />
                  <Select
                    value={sub.priority || 'medium'}
                    onValueChange={(v) => {
                      const updated = [...formData.subTemplates];
                      updated[index] = { ...sub, priority: v as 'low' | 'medium' | 'high' };
                      setFormData({ ...formData, subTemplates: updated });
                    }}
                  >
                    <SelectTrigger className="w-24 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        subTemplates: formData.subTemplates.filter((_, i) => i !== index)
                      });
                    }}
                    data-testid={`subtask-delete-${index}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Input
              value={newSubTaskTitle}
              onChange={(e) => setNewSubTaskTitle(e.target.value)}
              placeholder="Add a sub-task..."
              className="flex-1 h-8"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newSubTaskTitle.trim()) {
                  e.preventDefault();
                  setFormData({
                    ...formData,
                    subTemplates: [
                      ...formData.subTemplates,
                      { id: crypto.randomUUID(), title: newSubTaskTitle.trim(), priority: 'medium' }
                    ]
                  });
                  setNewSubTaskTitle('');
                }
              }}
              data-testid="new-subtask-input"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!newSubTaskTitle.trim()}
              onClick={() => {
                if (newSubTaskTitle.trim()) {
                  setFormData({
                    ...formData,
                    subTemplates: [
                      ...formData.subTemplates,
                      { id: crypto.randomUUID(), title: newSubTaskTitle.trim(), priority: 'medium' }
                    ]
                  });
                  setNewSubTaskTitle('');
                }
              }}
              data-testid="add-subtask-button"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {formData.subTemplates.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {formData.subTemplates.length} sub-task{formData.subTemplates.length !== 1 ? 's' : ''} will be created under the parent task
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="taskItems">Task Items / Notes (becomes task note)</Label>
        <Textarea
          id="taskItems"
          value={formData.taskItems}
          onChange={(e) => setFormData({ ...formData, taskItems: e.target.value })}
          placeholder="Enter EOS format items, checklist, or any details...&#10;&#10;Example:&#10;- Review Q1 Rocks progress&#10;- Discuss blockers&#10;- Update scorecard"
          rows={6}
          data-testid="template-task-items-input"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
          />
          <Label htmlFor="isActive">Active</Label>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !formData.name.trim()}>
          {isSubmitting ? 'Saving...' : 'Save Deliverable'}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface TemplateCardProps {
  template: TaskTemplate;
  projects: Project[];
  people: Person[];
  onEdit: (template: TaskTemplate) => void;
  onDelete: (id: string) => void;
  onTrigger: (template: TaskTemplate) => void;
}

function TemplateCard({ template, projects, people, onEdit, onDelete, onTrigger }: TemplateCardProps) {
  const project = template.projectId ? projects.find(p => p.id === template.projectId) : null;
  const assignedPeople = people.filter(p => template.assignedTo?.includes(p.id));
  
  return (
    <Card 
      className={`${template.isActive === 'false' ? 'opacity-60' : ''}`}
      data-testid={`template-card-${template.id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <FileStack className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="truncate">{template.name}</span>
            </CardTitle>
            {template.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{template.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button 
              variant="default" 
              size="sm"
              onClick={() => onTrigger(template)}
              title="Create task from deliverable"
              data-testid={`trigger-template-${template.id}`}
            >
              <Play className="h-4 w-4 mr-1" />
              Create
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onEdit(template)}
              data-testid={`edit-template-${template.id}`}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onDelete(template.id)}
              className="text-destructive"
              data-testid={`delete-template-${template.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 flex-wrap">
          {project && (
            <Badge variant="outline" className="gap-1">
              <FolderKanban className="h-3 w-3" />
              {project.name}
            </Badge>
          )}
          {template.recurrence && (
            <Badge variant="secondary" className="gap-1">
              <RefreshCw className="h-3 w-3" />
              {template.recurrence}
            </Badge>
          )}
          {assignedPeople.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Users className="h-3 w-3" />
              {assignedPeople.length} assignee{assignedPeople.length !== 1 ? 's' : ''}
            </Badge>
          )}
          {template.lastUsedAt && (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              Last: {new Date(template.lastUsedAt).toLocaleDateString()}
            </Badge>
          )}
        </div>
        {template.taskItems && (
          <div className="mt-3 p-2 bg-muted/50 rounded text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
            {template.taskItems}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TaskTemplates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery<TaskTemplate[]>({
    queryKey: ['/api/task-templates'],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const { data: people = [] } = useQuery<Person[]>({
    queryKey: ['/api/people'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      const res = await apiRequest('POST', '/api/task-templates', {
        name: data.name,
        description: data.description || null,
        projectId: data.projectId || null,
        assignedTo: data.assignedTo,
        assignmentMode: data.assignmentMode || 'single',
        subTemplates: data.subTemplates || [],
        taskItems: data.taskItems || null,
        recurrence: data.recurrence || null,
        isActive: data.isActive ? 'true' : 'false',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/task-templates'] });
      toast({ title: 'Deliverable created' });
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TemplateFormData }) => {
      const res = await apiRequest('PATCH', `/api/task-templates/${id}`, {
        name: data.name,
        description: data.description || null,
        projectId: data.projectId || null,
        assignedTo: data.assignedTo,
        assignmentMode: data.assignmentMode || 'single',
        subTemplates: data.subTemplates || [],
        taskItems: data.taskItems || null,
        recurrence: data.recurrence || null,
        isActive: data.isActive ? 'true' : 'false',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/task-templates'] });
      toast({ title: 'Deliverable updated' });
      setIsDialogOpen(false);
      setEditingTemplate(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/task-templates/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/task-templates'] });
      toast({ title: 'Deliverable deleted' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const triggerMutation = useMutation({
    mutationFn: async (template: TaskTemplate) => {
      const notes: { content: string; author: string; timestamp: string }[] = [];
      if (template.taskItems) {
        notes.push({
          content: template.taskItems,
          author: user?.email || 'system',
          timestamp: new Date().toISOString()
        });
      }
      
      const assignees = template.assignedTo || [];
      const mode = template.assignmentMode || 'single';
      const subTemplates = (template.subTemplates as SubTemplateItem[]) || [];
      let tasksCreated = 0;
      let subTasksCreated = 0;
      
      // Helper to create sub-tasks for a parent
      const createSubTasks = async (parentTaskId: string, parentAssignees: string[]) => {
        if (subTemplates.length === 0) return 0;
        const subTaskPromises = subTemplates.map(sub => 
          apiRequest('POST', '/api/tasks', {
            title: sub.title,
            projectId: template.projectId || null,
            assignedTo: sub.assignedTo && sub.assignedTo.length > 0 ? sub.assignedTo : parentAssignees,
            parentTaskId,
            status: 'todo',
            priority: sub.priority || 'medium',
            createdBy: user?.email || 'system',
          })
        );
        await Promise.all(subTaskPromises);
        return subTemplates.length;
      };
      
      if (mode === 'per-person' && assignees.length > 1) {
        // Create separate task for each assignee
        const createPromises = assignees.map(async (personId) => {
          const res = await apiRequest('POST', '/api/tasks', {
            title: template.name,
            projectId: template.projectId || null,
            assignedTo: [personId],
            notes,
            status: 'todo',
            priority: 'medium',
            createdBy: user?.email || 'system',
          });
          const parentTask = await res.json();
          const subCount = await createSubTasks(parentTask.id, [personId]);
          return { parent: 1, subs: subCount };
        });
        const results = await Promise.all(createPromises);
        tasksCreated = results.length;
        subTasksCreated = results.reduce((sum, r) => sum + r.subs, 0);
      } else {
        // Create single task with all assignees (default behavior)
        const res = await apiRequest('POST', '/api/tasks', {
          title: template.name,
          projectId: template.projectId || null,
          assignedTo: assignees,
          notes,
          status: 'todo',
          priority: 'medium',
          createdBy: user?.email || 'system',
        });
        const parentTask = await res.json();
        tasksCreated = 1;
        subTasksCreated = await createSubTasks(parentTask.id, assignees);
      }
      
      await apiRequest('PATCH', `/api/task-templates/${template.id}`, { 
        lastUsedAt: new Date().toISOString() 
      });
      
      return { tasksCreated, subTasksCreated };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/task-templates'] });
      const parentCount = data?.tasksCreated || 1;
      const subCount = data?.subTasksCreated || 0;
      let message = parentCount > 1 ? `${parentCount} tasks created` : 'Task created';
      if (subCount > 0) {
        message += ` with ${subCount} sub-task${subCount !== 1 ? 's' : ''}`;
      }
      toast({ title: message });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleEdit = (template: TaskTemplate) => {
    setEditingTemplate(template);
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: TemplateFormData) => {
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTemplate(null);
  };

  const getInitialFormData = (): TemplateFormData | undefined => {
    if (!editingTemplate) return undefined;
    return {
      name: editingTemplate.name,
      description: editingTemplate.description || '',
      projectId: editingTemplate.projectId || '',
      assignedTo: editingTemplate.assignedTo || [],
      assignmentMode: (editingTemplate.assignmentMode as 'single' | 'per-person') || 'single',
      subTemplates: (editingTemplate.subTemplates as SubTemplateItem[]) || [],
      taskItems: editingTemplate.taskItems || '',
      recurrence: editingTemplate.recurrence || '',
      isActive: editingTemplate.isActive !== 'false',
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileStack className="h-5 w-5" />
          Recurring Deliverables
        </h2>
        <Button onClick={() => setIsDialogOpen(true)} data-testid="new-template-btn">
          <Plus className="h-4 w-4 mr-1" />
          New Deliverable
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileStack className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Deliverables Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create deliverables for recurring tasks like weekly syncs, sprint planning, or EOS updates.
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create First Deliverable
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              projects={projects}
              people={people}
              onEdit={handleEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
              onTrigger={(t) => triggerMutation.mutate(t)}
            />
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Deliverable' : 'Create Deliverable'}
            </DialogTitle>
          </DialogHeader>
          <TemplateForm
            key={editingTemplate?.id || 'new'}
            initialData={getInitialFormData()}
            projects={projects}
            people={people}
            onSubmit={handleSubmit}
            onCancel={handleCloseDialog}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
