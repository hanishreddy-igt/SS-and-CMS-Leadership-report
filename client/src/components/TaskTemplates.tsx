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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  Users,
  UserPlus,
  Check
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
              {projects
                .filter(p => {
                  // Filter to active projects only (end date in future or no end date)
                  if (!p.endDate) return true;
                  const end = new Date(p.endDate);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return end >= today;
                })
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(p => (
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
            [...people]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(person => (
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
              {formData.subTemplates.map((sub, index) => {
                const parentAssignees = people
                  .filter(p => formData.assignedTo.includes(p.id))
                  .sort((a, b) => a.name.localeCompare(b.name));
                const subAssigneeCount = sub.assignedTo?.length || 0;
                const inheritsFromParent = !sub.assignedTo || sub.assignedTo.length === 0;
                
                return (
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
                    
                    {/* Assignee selector popover */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 min-w-[90px]"
                          data-testid={`subtask-assignees-${index}`}
                        >
                          <Users className="h-3 w-3" />
                          {inheritsFromParent ? (
                            <span className="text-muted-foreground">All</span>
                          ) : (
                            <span>{subAssigneeCount} of {parentAssignees.length}</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-3" align="end">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Assign to</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => {
                                const updated = [...formData.subTemplates];
                                updated[index] = { ...sub, assignedTo: undefined };
                                setFormData({ ...formData, subTemplates: updated });
                              }}
                            >
                              Reset to All
                            </Button>
                          </div>
                          
                          {parentAssignees.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No assignees selected for parent task
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {parentAssignees.map(person => {
                                // When inheriting, all are conceptually selected
                                const isSelected = inheritsFromParent || (sub.assignedTo?.includes(person.id) ?? false);
                                return (
                                  <div
                                    key={person.id}
                                    className="flex items-center gap-2 p-1 rounded hover-elevate cursor-pointer"
                                    onClick={() => {
                                      const updated = [...formData.subTemplates];
                                      // If inheriting, start from full parent list; otherwise use current
                                      const currentAssigned = inheritsFromParent 
                                        ? parentAssignees.map(p => p.id)
                                        : (sub.assignedTo || []);
                                      let newAssigned: string[];
                                      
                                      if (isSelected) {
                                        // Deselect this person
                                        newAssigned = currentAssigned.filter(id => id !== person.id);
                                      } else {
                                        // Select this person
                                        newAssigned = [...currentAssigned, person.id];
                                      }
                                      
                                      // If all are selected or none, reset to inherit
                                      if (newAssigned.length === 0 || newAssigned.length === parentAssignees.length) {
                                        updated[index] = { ...sub, assignedTo: undefined };
                                      } else {
                                        updated[index] = { ...sub, assignedTo: newAssigned };
                                      }
                                      setFormData({ ...formData, subTemplates: updated });
                                    }}
                                    data-testid={`subtask-${index}-assignee-${person.id}`}
                                  >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                      isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'
                                    }`}>
                                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                                    </div>
                                    <span className="text-sm">{person.name}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          
                          <p className="text-xs text-muted-foreground">
                            {inheritsFromParent 
                              ? "Inheriting all parent assignees" 
                              : `${subAssigneeCount} specific assignee${subAssigneeCount !== 1 ? 's' : ''}`}
                          </p>
                        </div>
                      </PopoverContent>
                    </Popover>
                    
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
                );
              })}
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
  onView: (template: TaskTemplate) => void;
}

function TemplateCard({ template, projects, people, onEdit, onDelete, onTrigger, onView }: TemplateCardProps) {
  const project = template.projectId ? projects.find(p => p.id === template.projectId) : null;
  const assignedPeople = people.filter(p => template.assignedTo?.includes(p.id));
  
  return (
    <Card 
      className={`${template.isActive === 'false' ? 'opacity-60' : ''} cursor-pointer hover-elevate transition-all`}
      data-testid={`template-card-${template.id}`}
      onClick={() => onView(template)}
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
          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
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

interface TemplateDetailModalProps {
  template: TaskTemplate | null;
  projects: Project[];
  people: Person[];
  onClose: () => void;
  onEdit: (template: TaskTemplate) => void;
  onTrigger: (template: TaskTemplate) => void;
}

function TemplateDetailModal({ template, projects, people, onClose, onEdit, onTrigger }: TemplateDetailModalProps) {
  if (!template) return null;
  
  const project = template.projectId ? projects.find(p => p.id === template.projectId) : null;
  const assignedPeople = people.filter(p => template.assignedTo?.includes(p.id));
  const subTemplates = (template.subTemplates as SubTemplateItem[]) || [];
  
  return (
    <Dialog open={!!template} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileStack className="h-5 w-5 text-primary" />
            {template.name}
            {template.isActive === 'false' && (
              <Badge variant="secondary" className="ml-2">Inactive</Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {template.description && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
              <p className="text-sm">{template.description}</p>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Project</h4>
              <div className="flex items-center gap-1">
                {project ? (
                  <>
                    <FolderKanban className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{project.name}</span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">None</span>
                )}
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Recurrence</h4>
              <div className="flex items-center gap-1">
                {template.recurrence ? (
                  <>
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm capitalize">{template.recurrence}</span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">None</span>
                )}
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">
              Assignment Mode
            </h4>
            <span className="text-sm">
              {template.assignmentMode === 'per-person' 
                ? 'Separate task for each person' 
                : 'One task with all assignees'}
            </span>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">
              Assignees ({assignedPeople.length})
            </h4>
            {assignedPeople.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {assignedPeople.map(person => (
                  <Badge key={person.id} variant="secondary" className="gap-1">
                    <Users className="h-3 w-3" />
                    {person.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">No assignees</span>
            )}
          </div>
          
          {subTemplates.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">
                Sub-tasks ({subTemplates.length})
              </h4>
              <div className="space-y-2 p-2 bg-muted/50 rounded">
                {subTemplates.map((sub, index) => {
                  const hasSpecificAssignees = sub.assignedTo && sub.assignedTo.length > 0;
                  const subAssignees = hasSpecificAssignees 
                    ? people.filter(p => sub.assignedTo?.includes(p.id))
                    : assignedPeople;
                  
                  return (
                    <div key={sub.id} className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">{index + 1}.</span>
                        <span className="flex-1">{sub.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {sub.priority || 'medium'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 ml-5 flex-wrap">
                        {hasSpecificAssignees ? (
                          <>
                            {subAssignees.map(person => (
                              <Badge key={person.id} variant="secondary" className="text-xs gap-1">
                                {person.name}
                              </Badge>
                            ))}
                            <span className="text-xs text-muted-foreground">
                              ({subAssignees.length} of {assignedPeople.length})
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            All assignees
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {template.taskItems && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Task Items</h4>
              <div className="p-2 bg-muted/50 rounded text-sm whitespace-pre-wrap">
                {template.taskItems}
              </div>
            </div>
          )}
          
          {template.lastUsedAt && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Last Used</h4>
              <div className="flex items-center gap-1 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {new Date(template.lastUsedAt).toLocaleString()}
              </div>
            </div>
          )}
          
          <div className="text-xs text-muted-foreground">
            Created: {new Date(template.createdAt).toLocaleString()}
          </div>
        </div>
        
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="outline" onClick={() => { onClose(); onEdit(template); }}>
            <Edit2 className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button onClick={() => { onClose(); onTrigger(template); }}>
            <Play className="h-4 w-4 mr-1" />
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TaskTemplates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [viewingTemplate, setViewingTemplate] = useState<TaskTemplate | null>(null);

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
              onView={(t) => setViewingTemplate(t)}
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

      <TemplateDetailModal
        template={viewingTemplate}
        projects={projects}
        people={people}
        onClose={() => setViewingTemplate(null)}
        onEdit={handleEdit}
        onTrigger={(t) => triggerMutation.mutate(t)}
      />
    </div>
  );
}
