import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Play,
  FileStack,
  Calendar,
  RefreshCw,
  Clock
} from 'lucide-react';
import type { TaskTemplate, Project } from '@shared/schema';

const recurrenceOptions = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
];

const eosFormatOptions = [
  { value: 'rocks', label: 'Rocks (90-day goals)' },
  { value: 'issues', label: 'Issues (IDS process)' },
  { value: 'todos', label: 'To-dos (7-day actions)' },
  { value: 'scorecard', label: 'Scorecard metrics' },
];

interface TemplateFormData {
  name: string;
  description: string;
  projectId: string;
  recurrence: string;
  eosFormat: string;
  isActive: boolean;
  taskStructure: { title: string; children?: { title: string }[] }[];
}

interface TemplateFormProps {
  initialData?: TemplateFormData;
  projects: Project[];
  onSubmit: (data: TemplateFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

function TemplateForm({ initialData, projects, onSubmit, onCancel, isSubmitting }: TemplateFormProps) {
  const [formData, setFormData] = useState<TemplateFormData>(initialData || {
    name: '',
    description: '',
    projectId: '',
    recurrence: '',
    eosFormat: '',
    isActive: true,
    taskStructure: [{ title: '' }],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    
    const cleanedStructure = formData.taskStructure.filter(t => t.title.trim());
    onSubmit({
      ...formData,
      taskStructure: cleanedStructure.length > 0 ? cleanedStructure : [{ title: 'New Task' }],
    });
  };

  const addTaskItem = () => {
    setFormData({
      ...formData,
      taskStructure: [...formData.taskStructure, { title: '' }],
    });
  };

  const updateTaskItem = (index: number, title: string) => {
    const newStructure = [...formData.taskStructure];
    newStructure[index] = { ...newStructure[index], title };
    setFormData({ ...formData, taskStructure: newStructure });
  };

  const removeTaskItem = (index: number) => {
    setFormData({
      ...formData,
      taskStructure: formData.taskStructure.filter((_, i) => i !== index),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Template Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Weekly Team Sync"
          data-testid="template-name-input"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe what this template is for..."
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
          <Label>Recurrence</Label>
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
        <Label>EOS Format</Label>
        <Select 
          value={formData.eosFormat || "none"} 
          onValueChange={(v) => setFormData({ ...formData, eosFormat: v === "none" ? "" : v })}
        >
          <SelectTrigger data-testid="template-eos-select">
            <SelectValue placeholder="Optional EOS format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No EOS format</SelectItem>
            {eosFormatOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Task Structure</Label>
        <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
          {formData.taskStructure.map((task, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={task.title}
                onChange={(e) => updateTaskItem(index, e.target.value)}
                placeholder={`Task ${index + 1}`}
                className="flex-1"
                data-testid={`template-task-${index}`}
              />
              {formData.taskStructure.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeTaskItem(index)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addTaskItem}
            className="w-full"
            data-testid="add-template-task"
          >
            <Plus className="h-4 w-4 mr-1" /> Add Task
          </Button>
        </div>
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
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} data-testid="save-template">
          {isSubmitting ? 'Saving...' : 'Save Template'}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface TemplateCardProps {
  template: TaskTemplate;
  projects: Project[];
  onEdit: (template: TaskTemplate) => void;
  onDelete: (id: string) => void;
  onUse: (template: TaskTemplate) => void;
}

function TemplateCard({ template, projects, onEdit, onDelete, onUse }: TemplateCardProps) {
  const project = template.projectId ? projects.find(p => p.id === template.projectId) : null;
  const taskCount = Array.isArray(template.taskStructure) ? template.taskStructure.length : 0;
  
  return (
    <Card 
      className={`${template.isActive === 'false' ? 'opacity-60' : ''}`}
      data-testid={`template-card-${template.id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileStack className="h-4 w-4 text-primary" />
              {template.name}
            </CardTitle>
            {template.description && (
              <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onUse(template)}
              title="Use template"
              data-testid={`use-template-${template.id}`}
            >
              <Play className="h-4 w-4 text-primary" />
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
              <Calendar className="h-3 w-3" />
              {project.name}
            </Badge>
          )}
          {template.recurrence && (
            <Badge variant="secondary" className="gap-1">
              <RefreshCw className="h-3 w-3" />
              {template.recurrence}
            </Badge>
          )}
          {template.eosFormat && (
            <Badge variant="secondary" className="gap-1">
              EOS: {template.eosFormat}
            </Badge>
          )}
          <Badge variant="outline" className="gap-1">
            {taskCount} task{taskCount !== 1 ? 's' : ''}
          </Badge>
          {template.lastUsedAt && (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              Last used: {new Date(template.lastUsedAt).toLocaleDateString()}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function TaskTemplates() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery<TaskTemplate[]>({
    queryKey: ['/api/task-templates'],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      const res = await apiRequest('POST', '/api/task-templates', {
        name: data.name,
        description: data.description || null,
        projectId: data.projectId || null,
        recurrence: data.recurrence || null,
        eosFormat: data.eosFormat || null,
        isActive: data.isActive ? 'true' : 'false',
        taskStructure: data.taskStructure,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/task-templates'] });
      toast({ title: 'Template created' });
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
        recurrence: data.recurrence || null,
        eosFormat: data.eosFormat || null,
        isActive: data.isActive ? 'true' : 'false',
        taskStructure: data.taskStructure,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/task-templates'] });
      toast({ title: 'Template updated' });
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
      toast({ title: 'Template deleted' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const useTemplateMutation = useMutation({
    mutationFn: async (template: TaskTemplate) => {
      const tasks = Array.isArray(template.taskStructure) ? template.taskStructure : [];
      const promises = tasks.map((task: { title: string }) => 
        apiRequest('POST', '/api/tasks', {
          title: task.title,
          projectId: template.projectId || null,
        })
      );
      await Promise.all(promises);
      
      await apiRequest('PATCH', `/api/task-templates/${template.id}`, { 
        lastUsedAt: new Date().toISOString() 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/task-templates'] });
      toast({ title: 'Tasks created from template' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (data: TemplateFormData) => {
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (template: TaskTemplate) => {
    setEditingTemplate(template);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTemplate(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="task-templates-section">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Create recurring task templates for regular workflows like weekly syncs, sprint planning, and EOS updates.
        </p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingTemplate(null)} data-testid="create-template-btn">
              <Plus className="h-4 w-4 mr-1" /> New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? 'Edit Template' : 'Create Template'}
              </DialogTitle>
            </DialogHeader>
            <TemplateForm
              initialData={editingTemplate ? {
                name: editingTemplate.name,
                description: editingTemplate.description || '',
                projectId: editingTemplate.projectId || '',
                recurrence: editingTemplate.recurrence || '',
                eosFormat: editingTemplate.eosFormat || '',
                isActive: editingTemplate.isActive === 'true',
                taskStructure: Array.isArray(editingTemplate.taskStructure) 
                  ? editingTemplate.taskStructure as { title: string }[]
                  : [{ title: '' }],
              } : undefined}
              projects={projects}
              onSubmit={handleSubmit}
              onCancel={handleCloseDialog}
              isSubmitting={createMutation.isPending || updateMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileStack className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Templates Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first template to quickly generate recurring task sets.
            </p>
            <Button onClick={() => setIsDialogOpen(true)} data-testid="create-first-template">
              <Plus className="h-4 w-4 mr-1" /> Create Template
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
              onEdit={handleEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
              onUse={(t) => useTemplateMutation.mutate(t)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
