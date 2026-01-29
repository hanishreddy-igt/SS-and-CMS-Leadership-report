import { useState, useMemo } from 'react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
  User,
  UserPlus,
  Check,
  Filter
} from 'lucide-react';
import type { TaskTemplate, Project, Person, SubTemplateItem } from '@shared/schema';

// Helper to get friendly timezone abbreviation
const getTimezoneAbbr = (date: Date): string => {
  const rawTz = date.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop() || '';
  
  // Map common GMT offsets to friendly abbreviations
  const offsetMap: Record<string, string> = {
    'GMT+5:30': 'IST',
    'GMT+5': 'PKT',
    'GMT+8': 'SGT',
    'GMT+9': 'JST',
    'GMT+10': 'AEST',
    'GMT+10:30': 'ACDT',
    'GMT+11': 'AEDT',
    'GMT+8:45': 'ACWST',
    'GMT+9:30': 'ACST',
    'GMT-8': 'PST',
    'GMT-7': 'MST',
    'GMT-6': 'CST',
    'GMT-5': 'EST',
    'GMT-4': 'EDT',
    'GMT+0': 'GMT',
    'GMT+1': 'CET',
    'GMT+2': 'SAST',
    'GMT+3': 'EAT',
    'GMT+4': 'GST',
  };
  
  return offsetMap[rawTz] || rawTz;
};

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
  // Legacy fields (for backward compatibility)
  deliveryTime: string;
  deliveryDay: string;
  deliveryDate: number | null;
  // New scheduling fields
  startTime: string;
  endTime: string;
  startDay: string;
  endDay: string;
  startDate: number | null;
  endDate: number | null;
  daysOfWeek: string[];
  timezone: string;
  isActive: boolean;
  autoTriggerEnabled: boolean;
}

const dayOptions = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

// Helper to parse timezone string to hours and minutes
const parseTimezoneToHoursMinutes = (tz: string): { sign: '+' | '-', hours: string, minutes: string } => {
  if (!tz) return { sign: '+', hours: '0', minutes: '00' };
  const match = tz.match(/^([+-]?)(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return { sign: '+', hours: '0', minutes: '00' };
  return {
    sign: match[1] === '-' ? '-' : '+',
    hours: match[2],
    minutes: match[3] || '00'
  };
};

// Helper to format timezone from hours and minutes
const formatTimezone = (sign: '+' | '-', hours: string, minutes: string): string => {
  const h = parseInt(hours) || 0;
  const m = parseInt(minutes) || 0;
  if (m === 0) return `${sign}${h}`;
  return `${sign}${h}:${m.toString().padStart(2, '0')}`;
};

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
    // Legacy fields
    deliveryTime: '09:00',
    deliveryDay: 'monday',
    deliveryDate: 1,
    // New fields
    startTime: '09:00',
    endTime: '17:00',
    startDay: 'monday',
    endDay: 'friday',
    startDate: 1,
    endDate: 5,
    daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    timezone: '+5:30',
    isActive: true,
    autoTriggerEnabled: false,
  });
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');
  
  // Determine which scheduling fields to show based on recurrence
  const isDaily = formData.recurrence === 'daily';
  const isWeeklyOrBiweekly = formData.recurrence === 'weekly' || formData.recurrence === 'biweekly';
  const isMonthlyOrQuarterly = formData.recurrence === 'monthly' || formData.recurrence === 'quarterly';
  const hasRecurrence = !!formData.recurrence;
  
  // Toggle day selection for daily recurrence
  const toggleDayOfWeek = (day: string) => {
    setFormData(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day]
    }));
  };
  
  const toggleAllDays = () => {
    const allDays = dayOptions.map(d => d.value);
    const allSelected = allDays.every(d => formData.daysOfWeek.includes(d));
    setFormData(prev => ({
      ...prev,
      daysOfWeek: allSelected ? [] : allDays
    }));
  };

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
          <Label>Account</Label>
          <Select 
            value={formData.projectId || "none"} 
            onValueChange={(v) => setFormData({ ...formData, projectId: v === "none" ? "" : v })}
          >
            <SelectTrigger data-testid="template-account-select">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No account</SelectItem>
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

      {/* Scheduling fields - shown when recurrence is selected */}
      {hasRecurrence && (
        <div className="p-4 bg-muted/50 rounded-lg space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Label className="font-medium">Work Schedule</Label>
          </div>
          
          {/* Daily recurrence - Day selection */}
          {isDaily && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Days of Week</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={toggleAllDays}
                  className="h-6 text-xs"
                >
                  {dayOptions.every(d => formData.daysOfWeek.includes(d.value)) ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {dayOptions.map(day => (
                  <Button
                    key={day.value}
                    type="button"
                    variant={formData.daysOfWeek.includes(day.value) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleDayOfWeek(day.value)}
                    className="h-8"
                    data-testid={`day-${day.value}`}
                  >
                    {day.label.slice(0, 3)}
                  </Button>
                ))}
              </div>
            </div>
          )}
          
          {/* Weekly/Bi-weekly - Start and End Day */}
          {isWeeklyOrBiweekly && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Day</Label>
                <Select 
                  value={formData.startDay} 
                  onValueChange={(v) => setFormData({ ...formData, startDay: v })}
                >
                  <SelectTrigger data-testid="template-start-day">
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    {dayOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Day</Label>
                <Select 
                  value={formData.endDay} 
                  onValueChange={(v) => setFormData({ ...formData, endDay: v })}
                >
                  <SelectTrigger data-testid="template-end-day">
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    {dayOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          {/* Monthly/Quarterly - Start and End Date */}
          {isMonthlyOrQuarterly && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date (day of month)</Label>
                <Select 
                  value={formData.startDate?.toString() || '1'} 
                  onValueChange={(v) => setFormData({ ...formData, startDate: parseInt(v) })}
                >
                  <SelectTrigger data-testid="template-start-date">
                    <SelectValue placeholder="Select date" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                      <SelectItem key={day} value={day.toString()}>{day}</SelectItem>
                    ))}
                    <SelectItem value="0">Last day of month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Date (day of month)</Label>
                <Select 
                  value={formData.endDate?.toString() || '5'} 
                  onValueChange={(v) => setFormData({ ...formData, endDate: parseInt(v) })}
                >
                  <SelectTrigger data-testid="template-end-date">
                    <SelectValue placeholder="Select date" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                      <SelectItem key={day} value={day.toString()}>{day}</SelectItem>
                    ))}
                    <SelectItem value="0">Last day of month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          {/* Time fields - Start Time and End/Due Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time (task created)</Label>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                data-testid="template-start-time"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">Due Time</Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                data-testid="template-end-time"
              />
            </div>
          </div>
          
          {/* Timezone - manual entry */}
          <div className="space-y-2">
            <Label>Timezone (GMT offset)</Label>
            <div className="flex items-center gap-1">
              <Select
                value={parseTimezoneToHoursMinutes(formData.timezone).sign}
                onValueChange={(sign) => {
                  const parsed = parseTimezoneToHoursMinutes(formData.timezone);
                  setFormData({ ...formData, timezone: formatTimezone(sign as '+' | '-', parsed.hours, parsed.minutes) });
                }}
              >
                <SelectTrigger className="w-16" data-testid="template-timezone-sign">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="+">+</SelectItem>
                  <SelectItem value="-">-</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min="0"
                max="14"
                className="w-16 text-center"
                placeholder="Hr"
                value={parseTimezoneToHoursMinutes(formData.timezone).hours}
                onChange={(e) => {
                  const parsed = parseTimezoneToHoursMinutes(formData.timezone);
                  const hours = Math.max(0, Math.min(14, parseInt(e.target.value) || 0)).toString();
                  setFormData({ ...formData, timezone: formatTimezone(parsed.sign, hours, parsed.minutes) });
                }}
                data-testid="template-timezone-hours"
              />
              <span className="text-muted-foreground">:</span>
              <Input
                type="number"
                min="0"
                max="59"
                step="15"
                className="w-16 text-center"
                placeholder="Min"
                value={parseTimezoneToHoursMinutes(formData.timezone).minutes}
                onChange={(e) => {
                  const parsed = parseTimezoneToHoursMinutes(formData.timezone);
                  const mins = Math.max(0, Math.min(59, parseInt(e.target.value) || 0)).toString().padStart(2, '0');
                  setFormData({ ...formData, timezone: formatTimezone(parsed.sign, parsed.hours, mins) });
                }}
                data-testid="template-timezone-minutes"
              />
              <span className="text-sm text-muted-foreground ml-2">e.g., +5:30 for IST, -8:00 for PST</span>
            </div>
          </div>
          
          {/* Validation for daily: end time must be >= start time */}
          {isDaily && formData.endTime < formData.startTime && (
            <p className="text-xs text-amber-600">
              Note: Due time is earlier than start time. The due date will be set for the same day.
            </p>
          )}
          
          {/* Manual creation notice */}
          <div className="text-xs text-muted-foreground bg-background/50 p-2 rounded border">
            <p className="font-medium mb-1">How it works:</p>
            <p>When you click the <strong>Create</strong> button on this deliverable, tasks will be created at the scheduled start time with due dates set to the scheduled end time.</p>
            <p className="mt-1 text-muted-foreground/80">Note: You need to manually click Create each time you want to generate tasks from this template.</p>
          </div>
        </div>
      )}

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
                      value={sub.priority || 'normal'}
                      onValueChange={(v) => {
                        const updated = [...formData.subTemplates];
                        updated[index] = { ...sub, priority: v as 'normal' | 'medium' | 'high' };
                        setFormData({ ...formData, subTemplates: updated });
                      }}
                    >
                      <SelectTrigger className="w-24 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
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
                      { id: crypto.randomUUID(), title: newSubTaskTitle.trim(), priority: 'normal' }
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
                      { id: crypto.randomUUID(), title: newSubTaskTitle.trim(), priority: 'normal' }
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

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Switch
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
          />
          <Label htmlFor="isActive">Active</Label>
        </div>
        {hasRecurrence && (
          <div className="flex items-center gap-2">
            <Switch
              id="autoTriggerEnabled"
              checked={formData.autoTriggerEnabled}
              onCheckedChange={(v) => setFormData({ ...formData, autoTriggerEnabled: v })}
            />
            <Label htmlFor="autoTriggerEnabled" className="text-sm">
              Auto-trigger (scheduled)
            </Label>
          </div>
        )}
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

// Parse timezone offset string (e.g., "+5:30", "-8", "+0") to minutes offset from UTC
const parseTimezoneOffset = (tz: string | null | undefined): number => {
  if (!tz) return 0;
  const match = tz.match(/^([+-]?)(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  const hoursOffset = parseInt(match[2], 10);
  const minutesOffset = parseInt(match[3] || '0', 10);
  return sign * (hoursOffset * 60 + minutesOffset);
};

// Consolidated scheduling calculation - all calculations done in UTC
// Returns { startDateTime: Date (UTC), dueDateTime: Date (UTC), dueDateTimeISO: string, displayString: string (in template TZ) }
const calculateNextScheduledDelivery = (template: TaskTemplate): { startDateTime: Date; dueDateTime: Date; dueDateTimeISO: string; displayString: string } | null => {
  // Use new fields if available, fall back to legacy
  const startTime = template.startTime || template.deliveryTime;
  const endTime = template.endTime || startTime;
  const startDay = template.startDay || template.deliveryDay || 'monday';
  const endDay = template.endDay || startDay;
  const startDate = template.startDate ?? template.deliveryDate ?? 1;
  const endDate = template.endDate ?? startDate;
  const daysOfWeek: string[] = template.daysOfWeek || [];
  
  if (!template.recurrence || !startTime) return null;
  
  const tzOffsetMinutes = parseTimezoneOffset(template.timezone);
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = (endTime || startTime).split(':').map(Number);
  
  // Get current UTC time
  const nowUTC = new Date();
  
  // Convert "now" to template timezone for comparison (add tzOffset to UTC)
  // Template TZ time = UTC + tzOffsetMinutes
  const nowInTzMs = nowUTC.getTime() + tzOffsetMinutes * 60 * 1000;
  const nowInTz = new Date(nowInTzMs);
  
  // Work with a "virtual" date in template timezone space
  // We'll calculate dates as if we're in UTC, then adjust
  const dayMap: Record<string, number> = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6
  };
  
  // Start with today in template timezone
  let targetYear = nowInTz.getUTCFullYear();
  let targetMonth = nowInTz.getUTCMonth();
  let targetDay = nowInTz.getUTCDate();
  
  // Create target datetime in template timezone
  const createDateInTz = (y: number, m: number, d: number, h: number, min: number): Date => {
    // Create as UTC, then subtract tzOffset to get actual UTC time
    const dateInTz = Date.UTC(y, m, d, h, min, 0, 0);
    return new Date(dateInTz - tzOffsetMinutes * 60 * 1000);
  };
  
  // Helper to get day of week in template timezone
  const getDayOfWeekInTz = (date: Date): number => {
    const inTz = new Date(date.getTime() + tzOffsetMinutes * 60 * 1000);
    return inTz.getUTCDay();
  };
  
  let startDateTimeUTC: Date;
  let dueDateUTC: Date;
  
  if (template.recurrence === 'daily') {
    // For daily: find next selected day
    const selectedDays = daysOfWeek.length > 0 ? daysOfWeek : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const selectedDayNumbers = selectedDays.map(d => dayMap[d]);
    
    // Try today first
    let currentDay = getDayOfWeekInTz(nowUTC);
    let daysToAdd = 0;
    
    // Find the next selected day
    for (let i = 0; i < 7; i++) {
      const checkDay = (currentDay + i) % 7;
      if (selectedDayNumbers.includes(checkDay)) {
        daysToAdd = i;
        break;
      }
    }
    
    const checkDate = new Date(nowInTzMs);
    checkDate.setUTCDate(checkDate.getUTCDate() + daysToAdd);
    
    startDateTimeUTC = createDateInTz(checkDate.getUTCFullYear(), checkDate.getUTCMonth(), checkDate.getUTCDate(), startHours, startMinutes);
    dueDateUTC = createDateInTz(checkDate.getUTCFullYear(), checkDate.getUTCMonth(), checkDate.getUTCDate(), endHours, endMinutes);
    
    // If start time has passed today, move to next selected day
    if (daysToAdd === 0 && startDateTimeUTC <= nowUTC) {
      for (let i = 1; i <= 7; i++) {
        const checkDay = (currentDay + i) % 7;
        if (selectedDayNumbers.includes(checkDay)) {
          daysToAdd = i;
          break;
        }
      }
      const nextDate = new Date(nowInTzMs);
      nextDate.setUTCDate(nextDate.getUTCDate() + daysToAdd);
      startDateTimeUTC = createDateInTz(nextDate.getUTCFullYear(), nextDate.getUTCMonth(), nextDate.getUTCDate(), startHours, startMinutes);
      dueDateUTC = createDateInTz(nextDate.getUTCFullYear(), nextDate.getUTCMonth(), nextDate.getUTCDate(), endHours, endMinutes);
    }
  } else if (template.recurrence === 'weekly' || template.recurrence === 'biweekly') {
    const startDayOfWeek = dayMap[startDay];
    const endDayOfWeek = dayMap[endDay];
    const currentDayOfWeek = getDayOfWeekInTz(nowUTC);
    let daysUntilStart = startDayOfWeek - currentDayOfWeek;
    if (daysUntilStart < 0) daysUntilStart += 7;
    
    // Calculate start date
    const startDateCalc = new Date(nowInTzMs);
    startDateCalc.setUTCDate(startDateCalc.getUTCDate() + daysUntilStart);
    
    startDateTimeUTC = createDateInTz(startDateCalc.getUTCFullYear(), startDateCalc.getUTCMonth(), startDateCalc.getUTCDate(), startHours, startMinutes);
    
    // If start time has passed today
    if (daysUntilStart === 0 && startDateTimeUTC <= nowUTC) {
      startDateCalc.setUTCDate(startDateCalc.getUTCDate() + 7);
      startDateTimeUTC = createDateInTz(startDateCalc.getUTCFullYear(), startDateCalc.getUTCMonth(), startDateCalc.getUTCDate(), startHours, startMinutes);
    }
    
    // For biweekly, check cadence
    if (template.recurrence === 'biweekly') {
      const anchorDate = template.lastUsedAt ? new Date(template.lastUsedAt) : new Date(template.createdAt);
      const daysSinceAnchor = Math.floor((startDateTimeUTC.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24));
      const weeksOffset = Math.floor(daysSinceAnchor / 7) % 2;
      if (weeksOffset !== 0) {
        startDateCalc.setUTCDate(startDateCalc.getUTCDate() + 7);
        startDateTimeUTC = createDateInTz(startDateCalc.getUTCFullYear(), startDateCalc.getUTCMonth(), startDateCalc.getUTCDate(), startHours, startMinutes);
      }
    }
    
    // Calculate due date from start date
    let daysUntilEnd = endDayOfWeek - startDayOfWeek;
    if (daysUntilEnd < 0) daysUntilEnd += 7; // End day is next week
    
    const endDateCalc = new Date(startDateCalc.getTime());
    endDateCalc.setUTCDate(endDateCalc.getUTCDate() + daysUntilEnd);
    dueDateUTC = createDateInTz(endDateCalc.getUTCFullYear(), endDateCalc.getUTCMonth(), endDateCalc.getUTCDate(), endHours, endMinutes);
  } else if (template.recurrence === 'monthly') {
    const actualStartDate = startDate === 0 ? new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate() : startDate;
    const actualEndDate = endDate === 0 ? new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate() : endDate;
    
    startDateTimeUTC = createDateInTz(targetYear, targetMonth, actualStartDate, startHours, startMinutes);
    
    if (startDateTimeUTC <= nowUTC) {
      // Move to next month
      const nextMonth = targetMonth + 1;
      const nextYear = nextMonth > 11 ? targetYear + 1 : targetYear;
      const adjMonth = nextMonth > 11 ? 0 : nextMonth;
      const newStartDate = startDate === 0 ? new Date(Date.UTC(nextYear, adjMonth + 1, 0)).getUTCDate() : startDate;
      startDateTimeUTC = createDateInTz(nextYear, adjMonth, newStartDate, startHours, startMinutes);
      targetYear = nextYear;
      targetMonth = adjMonth;
    }
    
    // Calculate due date - if endDate < startDate, it's next month
    let dueYear = targetYear;
    let dueMonth = targetMonth;
    if (actualEndDate < actualStartDate) {
      dueMonth = targetMonth + 1;
      if (dueMonth > 11) {
        dueMonth = 0;
        dueYear++;
      }
    }
    const finalEndDate = endDate === 0 ? new Date(Date.UTC(dueYear, dueMonth + 1, 0)).getUTCDate() : endDate;
    dueDateUTC = createDateInTz(dueYear, dueMonth, finalEndDate, endHours, endMinutes);
  } else if (template.recurrence === 'quarterly') {
    const currentQuarterStart = Math.floor(targetMonth / 3) * 3;
    const actualStartDate = startDate === 0 ? new Date(Date.UTC(targetYear, currentQuarterStart + 1, 0)).getUTCDate() : startDate;
    
    startDateTimeUTC = createDateInTz(targetYear, currentQuarterStart, actualStartDate, startHours, startMinutes);
    
    if (startDateTimeUTC <= nowUTC) {
      // Move to next quarter
      const nextQuarterStart = (currentQuarterStart + 3) % 12;
      const yearOffset = nextQuarterStart < currentQuarterStart ? 1 : 0;
      const newStartDate = startDate === 0 ? new Date(Date.UTC(targetYear + yearOffset, nextQuarterStart + 1, 0)).getUTCDate() : startDate;
      startDateTimeUTC = createDateInTz(targetYear + yearOffset, nextQuarterStart, newStartDate, startHours, startMinutes);
      targetYear += yearOffset;
      targetMonth = nextQuarterStart;
    }
    
    // Calculate due date
    const quarterMonth = Math.floor(targetMonth / 3) * 3;
    let dueYear = targetYear;
    let dueMonth = quarterMonth;
    const actualEndDate = endDate === 0 ? new Date(Date.UTC(dueYear, dueMonth + 1, 0)).getUTCDate() : endDate;
    if (actualEndDate < (startDate === 0 ? 31 : startDate)) {
      dueMonth++;
      if (dueMonth > quarterMonth + 2) dueMonth = quarterMonth + 2; // Stay within quarter
    }
    const finalEndDate = endDate === 0 ? new Date(Date.UTC(dueYear, dueMonth + 1, 0)).getUTCDate() : endDate;
    dueDateUTC = createDateInTz(dueYear, dueMonth, finalEndDate, endHours, endMinutes);
  } else {
    return null;
  }
  
  // Format display string in template timezone
  const displayStartInTz = new Date(startDateTimeUTC.getTime() + tzOffsetMinutes * 60 * 1000);
  const displayDueInTz = new Date(dueDateUTC.getTime() + tzOffsetMinutes * 60 * 1000);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const startStr = `${dayNames[displayStartInTz.getUTCDay()]}, ${monthNames[displayStartInTz.getUTCMonth()]} ${displayStartInTz.getUTCDate()} at ${startTime}`;
  const dueStr = `${dayNames[displayDueInTz.getUTCDay()]}, ${monthNames[displayDueInTz.getUTCMonth()]} ${displayDueInTz.getUTCDate()} at ${endTime}`;
  const displayString = `Start: ${startStr} → Due: ${dueStr}`;
  
  return { startDateTime: startDateTimeUTC, dueDateTime: dueDateUTC, dueDateTimeISO: dueDateUTC.toISOString(), displayString };
};

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
  const nextScheduledData = calculateNextScheduledDelivery(template);
  const nextScheduled = nextScheduledData?.displayString || null;
  const owner = people.find(p => p.email === template.createdBy);
  const ownerDisplay = owner?.name || template.createdBy?.split('@')[0] || 'Unknown';
  
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
              {(template as any).autoTriggerEnabled === 'true' && (
                <Badge variant="outline" className="text-xs text-success border-success">
                  Auto
                </Badge>
              )}
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
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-destructive"
                  data-testid={`delete-template-${template.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Recurring Deliverable</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{template.name}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => onDelete(template.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid={`confirm-delete-template-${template.id}`}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
          <Badge variant="outline" className="gap-1">
            <User className="h-3 w-3" />
            {ownerDisplay}
          </Badge>
          {template.lastUsedAt && (
            <Badge variant="outline" className="gap-1">
              <Play className="h-3 w-3" />
              Last triggered: {new Date(template.lastUsedAt).toLocaleDateString()}
            </Badge>
          )}
          {(template as any).lastTriggeredAt && (
            <Badge variant="outline" className="gap-1 text-success border-success">
              <RefreshCw className="h-3 w-3" />
              Auto: {new Date((template as any).lastTriggeredAt).toLocaleDateString()}
            </Badge>
          )}
        </div>
        {nextScheduled && (
          <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Next: {nextScheduled}</span>
            {template.timezone && <span className="opacity-70">(GMT{template.timezone})</span>}
          </div>
        )}
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
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <FileStack className="h-5 w-5 text-primary" />
            {template.name}
            {template.isActive === 'false' && (
              <Badge variant="secondary" className="ml-2">Inactive</Badge>
            )}
            {(template as any).autoTriggerEnabled === 'true' && (
              <Badge variant="outline" className="text-success border-success">Auto-trigger</Badge>
            )}
          </DialogTitle>
          {(template as any).lastTriggeredAt && (
            <p className="text-xs text-muted-foreground">
              Last auto-triggered: {new Date((template as any).lastTriggeredAt).toLocaleString()}
            </p>
          )}
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
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Account</h4>
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
          
          {/* Work Schedule - only show if recurrence is set */}
          {template.recurrence && (
            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Work Schedule
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {/* Daily: show selected days */}
                {template.recurrence === 'daily' && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Days: </span>
                    <span>
                      {((template.daysOfWeek || []).length > 0 
                        ? (template.daysOfWeek || []).map((d: string) => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')
                        : 'Mon, Tue, Wed, Thu, Fri')}
                    </span>
                  </div>
                )}
                {/* Weekly/Biweekly: show start and end day */}
                {(template.recurrence === 'weekly' || template.recurrence === 'biweekly') && (
                  <>
                    <div>
                      <span className="text-muted-foreground">Start Day: </span>
                      <span className="capitalize">{template.startDay || template.deliveryDay || 'monday'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Due Day: </span>
                      <span className="capitalize">{template.endDay || template.deliveryDay || 'monday'}</span>
                    </div>
                  </>
                )}
                {/* Monthly/Quarterly: show start and end date */}
                {(template.recurrence === 'monthly' || template.recurrence === 'quarterly') && (
                  <>
                    <div>
                      <span className="text-muted-foreground">Start Date: </span>
                      <span>
                        {(() => {
                          const d = template.startDate ?? template.deliveryDate ?? 1;
                          if (d === 0) return 'Last day';
                          return `${d}${['st', 'nd', 'rd'][((d % 100) - 20) % 10] || ['st', 'nd', 'rd'][d % 100] || 'th'}`;
                        })()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Due Date: </span>
                      <span>
                        {(() => {
                          const d = template.endDate ?? 5;
                          if (d === 0) return 'Last day';
                          return `${d}${['st', 'nd', 'rd'][((d % 100) - 20) % 10] || ['st', 'nd', 'rd'][d % 100] || 'th'}`;
                        })()}
                      </span>
                    </div>
                  </>
                )}
                <div>
                  <span className="text-muted-foreground">Start Time: </span>
                  <span>{template.startTime || template.deliveryTime || '09:00'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Due Time: </span>
                  <span>{template.endTime || '17:00'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Timezone: </span>
                  <span>GMT{template.timezone || '+0'}</span>
                </div>
              </div>
            </div>
          )}
          
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
                {new Date(template.lastUsedAt).toLocaleString()} {getTimezoneAbbr(new Date(template.lastUsedAt))}
              </div>
            </div>
          )}
          
          <div className="text-xs text-muted-foreground">
            Created: {new Date(template.createdAt).toLocaleString()} {getTimezoneAbbr(new Date(template.createdAt))}
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
  const [accountFilter, setAccountFilter] = useState<string>('all');

  const { data: templates = [], isLoading } = useQuery<TaskTemplate[]>({
    queryKey: ['/api/task-templates'],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const { data: people = [] } = useQuery<Person[]>({
    queryKey: ['/api/people'],
  });

  const sortedAccounts = useMemo(() => {
    return [...projects].sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const filteredTemplates = useMemo(() => {
    if (accountFilter === 'all') return templates;
    if (accountFilter === 'none') return templates.filter(t => !t.projectId);
    return templates.filter(t => t.projectId === accountFilter);
  }, [templates, accountFilter]);

  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      const isDaily = data.recurrence === 'daily';
      const isWeeklyOrBiweekly = data.recurrence === 'weekly' || data.recurrence === 'biweekly';
      const isMonthlyOrQuarterly = data.recurrence === 'monthly' || data.recurrence === 'quarterly';
      
      const res = await apiRequest('POST', '/api/task-templates', {
        name: data.name,
        description: data.description || null,
        projectId: data.projectId || null,
        assignedTo: data.assignedTo,
        assignmentMode: data.assignmentMode || 'single',
        subTemplates: data.subTemplates || [],
        taskItems: data.taskItems || null,
        recurrence: data.recurrence || null,
        // Legacy fields (for backward compatibility)
        deliveryTime: data.recurrence ? data.startTime : null,
        deliveryDay: isWeeklyOrBiweekly ? data.startDay : null,
        deliveryDate: isMonthlyOrQuarterly ? data.startDate : null,
        // New fields
        startTime: data.recurrence ? data.startTime : null,
        endTime: data.recurrence ? data.endTime : null,
        startDay: isWeeklyOrBiweekly ? data.startDay : null,
        endDay: isWeeklyOrBiweekly ? data.endDay : null,
        startDate: isMonthlyOrQuarterly ? data.startDate : null,
        endDate: isMonthlyOrQuarterly ? data.endDate : null,
        daysOfWeek: isDaily ? data.daysOfWeek : [],
        timezone: data.recurrence ? data.timezone : null,
        isActive: data.isActive ? 'true' : 'false',
        autoTriggerEnabled: data.autoTriggerEnabled ? 'true' : 'false',
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
      const isDaily = data.recurrence === 'daily';
      const isWeeklyOrBiweekly = data.recurrence === 'weekly' || data.recurrence === 'biweekly';
      const isMonthlyOrQuarterly = data.recurrence === 'monthly' || data.recurrence === 'quarterly';
      
      const res = await apiRequest('PATCH', `/api/task-templates/${id}`, {
        name: data.name,
        description: data.description || null,
        projectId: data.projectId || null,
        assignedTo: data.assignedTo,
        assignmentMode: data.assignmentMode || 'single',
        subTemplates: data.subTemplates || [],
        taskItems: data.taskItems || null,
        recurrence: data.recurrence || null,
        // Legacy fields (for backward compatibility)
        deliveryTime: data.recurrence ? data.startTime : null,
        deliveryDay: isWeeklyOrBiweekly ? data.startDay : null,
        deliveryDate: isMonthlyOrQuarterly ? data.startDate : null,
        // New fields
        startTime: data.recurrence ? data.startTime : null,
        endTime: data.recurrence ? data.endTime : null,
        startDay: isWeeklyOrBiweekly ? data.startDay : null,
        endDay: isWeeklyOrBiweekly ? data.endDay : null,
        startDate: isMonthlyOrQuarterly ? data.startDate : null,
        endDate: isMonthlyOrQuarterly ? data.endDate : null,
        daysOfWeek: isDaily ? data.daysOfWeek : [],
        timezone: data.recurrence ? data.timezone : null,
        isActive: data.isActive ? 'true' : 'false',
        autoTriggerEnabled: data.autoTriggerEnabled ? 'true' : 'false',
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

  // Helper to calculate due date from template delivery schedule using consolidated function
  // Returns full ISO datetime string to preserve time
  const calculateDueDate = (template: TaskTemplate): string | null => {
    const result = calculateNextScheduledDelivery(template);
    return result ? result.dueDateTimeISO : null;
  };

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
      const dueDate = calculateDueDate(template);
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
            priority: 'normal',
            dueDate: dueDate,
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
          priority: 'normal',
          dueDate: dueDate,
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
    
    // For backward compatibility: if new fields don't exist, derive from legacy fields
    const legacyStartTime = editingTemplate.deliveryTime || '09:00';
    const legacyDay = editingTemplate.deliveryDay || 'monday';
    const legacyDate = editingTemplate.deliveryDate ?? 1;
    
    return {
      name: editingTemplate.name,
      description: editingTemplate.description || '',
      projectId: editingTemplate.projectId || '',
      assignedTo: editingTemplate.assignedTo || [],
      assignmentMode: (editingTemplate.assignmentMode as 'single' | 'per-person') || 'single',
      subTemplates: (editingTemplate.subTemplates as SubTemplateItem[]) || [],
      taskItems: editingTemplate.taskItems || '',
      recurrence: editingTemplate.recurrence || '',
      // Legacy fields
      deliveryTime: legacyStartTime,
      deliveryDay: legacyDay,
      deliveryDate: legacyDate,
      // New fields - use existing if available, otherwise derive from legacy
      startTime: (editingTemplate as any).startTime || legacyStartTime,
      endTime: (editingTemplate as any).endTime || '17:00',
      startDay: (editingTemplate as any).startDay || legacyDay,
      endDay: (editingTemplate as any).endDay || 'friday',
      startDate: (editingTemplate as any).startDate ?? legacyDate,
      endDate: (editingTemplate as any).endDate ?? 5,
      daysOfWeek: (editingTemplate as any).daysOfWeek || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      timezone: editingTemplate.timezone || '+5:30',
      isActive: editingTemplate.isActive !== 'false',
      autoTriggerEnabled: (editingTemplate as any).autoTriggerEnabled === 'true',
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
      <div className="flex items-center justify-between gap-2">
        <Button onClick={() => setIsDialogOpen(true)} data-testid="new-template-btn">
          <Plus className="h-4 w-4 mr-1" />
          New Deliverable
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2" data-testid="template-filter-button">
              <Filter className="h-4 w-4" />
              Filter
              {accountFilter !== 'all' && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">1</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="end">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Account</Label>
              <Select value={accountFilter} onValueChange={setAccountFilter}>
                <SelectTrigger className="w-full" data-testid="template-account-filter">
                  <SelectValue placeholder="All Accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  <SelectItem value="none">No Account</SelectItem>
                  {sortedAccounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {accountFilter !== 'all' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setAccountFilter('all')}
                  data-testid="clear-template-filter"
                >
                  Clear filter
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileStack className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            {templates.length === 0 ? (
              <>
                <h3 className="text-lg font-medium mb-2">No Deliverables Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create deliverables for recurring tasks like weekly syncs, sprint planning, or EOS updates.
                </p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Create First Deliverable
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium mb-2">No Matching Deliverables</h3>
                <p className="text-muted-foreground mb-4">
                  No deliverables match the current filter.
                </p>
                <Button variant="outline" onClick={() => setAccountFilter('all')}>
                  Clear Filter
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredTemplates.map(template => (
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
