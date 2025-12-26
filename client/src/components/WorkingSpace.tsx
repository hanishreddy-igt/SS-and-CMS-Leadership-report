import { useState, useRef, useEffect, KeyboardEvent, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { format, isPast, isToday } from 'date-fns';
import { 
  Plus, 
  ChevronDown, 
  ChevronRight, 
  Trash2,
  FolderKanban,
  User,
  MessageSquare,
  Circle,
  CalendarIcon,
  Users,
  Hash,
  AtSign,
  StickyNote,
  X,
  Play,
  Check,
  Ban,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Task, Project, Person } from '@shared/schema';

const statusColors: Record<string, string> = {
  todo: 'bg-slate-500',
  'in-progress': 'bg-blue-500',
  blocked: 'bg-red-500',
  done: 'bg-green-500',
  cancelled: 'bg-gray-400',
};

const statusLabels: Record<string, string> = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  blocked: 'Blocked',
  done: 'Done',
  cancelled: 'Cancelled',
};

const STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
];

const STATUS_CYCLE = ['todo', 'in-progress', 'blocked', 'done'];

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
          title="In Progress - Click to change"
          aria-label="Status: In Progress. Click to change to Blocked"
          data-testid={testId}
        >
          <Play className={`${iconClass} text-blue-500 fill-blue-500`} />
        </button>
      );
    case 'blocked':
      return (
        <button 
          onClick={onClick} 
          className="p-0.5 hover:bg-accent rounded" 
          title="Blocked - Click to change"
          aria-label="Status: Blocked. Click to change to Done"
          data-testid={testId}
        >
          <Ban className={`${iconClass} text-red-500`} />
        </button>
      );
    case 'done':
      return (
        <button 
          onClick={onClick} 
          className="p-0.5 hover:bg-accent rounded" 
          title="Done - Click to change"
          aria-label="Status: Done. Click to change to To Do"
          data-testid={testId}
        >
          <Check className={`${iconClass} text-green-500`} />
        </button>
      );
    default:
      return (
        <button 
          onClick={onClick} 
          className="p-0.5 hover:bg-accent rounded" 
          title="Click to change status"
          aria-label="Click to change status"
          data-testid={testId}
        >
          <Circle className={`${iconClass} text-slate-400`} />
        </button>
      );
  }
}

interface ParsedTitle {
  text: string;
  projectTag?: string;
  personTags: string[];
  statusTag?: string;
  noteText?: string;
}

function parseInlineTags(title: string): ParsedTitle {
  const result: ParsedTitle = { text: title, personTags: [] };
  
  const noteMatch = title.match(/\/\/(.+?)(?=@@|@(?!@)|#|$)/);
  if (noteMatch) {
    result.noteText = noteMatch[1].trim();
    result.text = result.text.replace(/\/\/.+?(?=@@|@(?!@)|#|$)/, '').trim();
  }
  
  const projectMatch = result.text.match(/@@(\w+)/);
  if (projectMatch) {
    result.projectTag = projectMatch[1];
    result.text = result.text.replace(/@@\w+/g, '').trim();
  }
  
  const textAfterProject = result.text;
  const personMatches = textAfterProject.match(/@(\w+)/g);
  if (personMatches) {
    result.personTags = personMatches.map(m => m.substring(1));
    result.text = result.text.replace(/@\w+/g, '').trim();
  }
  
  const statusMatch = title.match(/#(todo|in-progress|blocked|done|inprogress|cancelled)/i);
  if (statusMatch) {
    let status = statusMatch[1].toLowerCase();
    if (status === 'inprogress') status = 'in-progress';
    result.statusTag = status;
    result.text = result.text.replace(/#(todo|in-progress|blocked|done|inprogress|cancelled)/gi, '').trim();
  }
  
  // Clean up any orphaned tag prefixes (@@, @, #, //) that weren't matched
  result.text = result.text
    .replace(/@@\s*/g, '')  // Remove orphaned @@
    .replace(/@\s*/g, '')   // Remove orphaned @
    .replace(/#\s*/g, '')   // Remove orphaned #
    .replace(/\/\/\s*/g, '') // Remove orphaned //
    .replace(/\s+/g, ' ')   // Normalize multiple spaces
    .trim();
  
  return result;
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

interface TaskNote {
  content: string;
  author: string;
  timestamp: string;
}

interface SuggestionState {
  type: 'project' | 'person' | 'status' | null;
  startIndex: number;
  query: string;
}

interface InlineTaskInputProps {
  onSubmit: (title: string, parsed: ParsedTitle) => void;
  placeholder?: string;
  autoFocus?: boolean;
  depth?: number;
  onIndent?: () => void;
  onOutdent?: () => void;
  onCancel?: () => void;
  projects?: Project[];
  people?: Person[];
}

function InlineTaskInput({ 
  onSubmit, 
  placeholder = "Type a task... (@@project @person #status //note)", 
  autoFocus = false, 
  depth = 0,
  onIndent,
  onOutdent,
  onCancel,
  projects = [],
  people = []
}: InlineTaskInputProps) {
  const [value, setValue] = useState('');
  const [suggestion, setSuggestion] = useState<SuggestionState>({ type: null, startIndex: 0, query: '' });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const detectTrigger = (text: string, cursorPos: number): SuggestionState => {
    const beforeCursor = text.slice(0, cursorPos);
    
    const projectMatch = beforeCursor.match(/@@(\w*)$/);
    if (projectMatch) {
      return { type: 'project', startIndex: projectMatch.index!, query: projectMatch[1] };
    }
    
    const personMatch = beforeCursor.match(/(?<![@@])@(\w*)$/);
    if (personMatch) {
      return { type: 'person', startIndex: personMatch.index!, query: personMatch[1] };
    }
    
    const statusMatch = beforeCursor.match(/#(\w*)$/);
    if (statusMatch) {
      return { type: 'status', startIndex: statusMatch.index!, query: statusMatch[1] };
    }
    
    return { type: null, startIndex: 0, query: '' };
  };

  const getTaggedProject = (): Project | undefined => {
    const projectMatch = value.match(/@@(\w+)/);
    if (projectMatch) {
      const projectTag = projectMatch[1].toLowerCase();
      return projects.find(p => 
        p.name.toLowerCase().replace(/\s+/g, '').includes(projectTag) ||
        p.name.toLowerCase().includes(projectTag)
      );
    }
    return undefined;
  };

  const getProjectPeople = (project: Project): Person[] => {
    const projectPeopleIds = new Set<string>();
    if (project.leadId) projectPeopleIds.add(project.leadId);
    if (project.leadIds) {
      project.leadIds.forEach(id => projectPeopleIds.add(id));
    }
    if (project.teamMembers && Array.isArray(project.teamMembers)) {
      (project.teamMembers as Array<{memberId: string}>).forEach(tm => {
        if (tm.memberId) projectPeopleIds.add(tm.memberId);
      });
    }
    return people.filter(p => projectPeopleIds.has(p.id));
  };

  const getPersonRoleLabel = (person: Person): string => {
    const roles = person.roles || [];
    const isLead = roles.includes('lead') || roles.includes('project-lead');
    const isMember = roles.includes('member') || roles.includes('team-member');
    if (isLead && isMember) return `${person.name} (Lead/Member)`;
    if (isLead) return `${person.name} (Lead)`;
    if (isMember) return `${person.name} (Member)`;
    return person.name;
  };

  const getSuggestions = (): { value: string; label: string; id?: string }[] => {
    if (suggestion.type === 'project') {
      return projects
        .filter(p => p.name.toLowerCase().includes(suggestion.query.toLowerCase()))
        .slice(0, 8)
        .map(p => ({ value: p.name.replace(/\s+/g, ''), label: p.name, id: p.id }));
    }
    if (suggestion.type === 'person') {
      const taggedProject = getTaggedProject();
      const availablePeople = taggedProject ? getProjectPeople(taggedProject) : people;
      return availablePeople
        .filter(p => p.name.toLowerCase().includes(suggestion.query.toLowerCase()))
        .slice(0, 8)
        .map(p => ({ value: p.name.split(' ')[0], label: getPersonRoleLabel(p), id: p.id }));
    }
    if (suggestion.type === 'status') {
      return STATUS_OPTIONS.filter(s => 
        s.label.toLowerCase().includes(suggestion.query.toLowerCase()) ||
        s.value.toLowerCase().includes(suggestion.query.toLowerCase())
      );
    }
    return [];
  };

  const suggestions = getSuggestions();

  const insertSuggestion = (item: { value: string; label: string }) => {
    const prefix = suggestion.type === 'project' ? '@@' : suggestion.type === 'person' ? '@' : '#';
    const beforeTrigger = value.slice(0, suggestion.startIndex);
    const afterCursor = value.slice(suggestion.startIndex + prefix.length + suggestion.query.length);
    const newValue = beforeTrigger + prefix + item.value + ' ' + afterCursor;
    setValue(newValue.trim() + ' ');
    setSuggestion({ type: null, startIndex: 0, query: '' });
    setSelectedIndex(0);
    inputRef.current?.focus();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setValue(newValue);
    const newSuggestion = detectTrigger(newValue, cursorPos);
    setSuggestion(newSuggestion);
    setSelectedIndex(0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (suggestion.type && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertSuggestion(suggestions[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSuggestion({ type: null, startIndex: 0, query: '' });
        return;
      }
    }

    if (e.key === 'Enter' && value.trim()) {
      const parsed = parseInlineTags(value.trim());
      onSubmit(value.trim(), parsed);
      setValue('');
      setSuggestion({ type: null, startIndex: 0, query: '' });
    }
    if (e.key === 'Escape') {
      if (onCancel) {
        onCancel();
      } else {
        setValue('');
        setSuggestion({ type: null, startIndex: 0, query: '' });
      }
    }
    if (e.key === 'Tab' && (!suggestion.type || suggestions.length === 0)) {
      e.preventDefault();
      if (e.shiftKey) {
        if (onCancel) {
          onCancel();
        } else if (onOutdent) {
          onOutdent();
        }
      } else if (!e.shiftKey && onIndent) {
        onIndent();
      }
    }
  };

  return (
    <div 
      className="relative flex items-center gap-2 py-1.5"
      style={{ paddingLeft: depth > 0 ? `${depth * 24 + 8}px` : '8px' }}
    >
      <Circle className="h-3 w-3 text-muted-foreground/40" />
      <div className="relative flex-1">
        <Input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            setTimeout(() => {
              setSuggestion({ type: null, startIndex: 0, query: '' });
            }, 150);
          }}
          placeholder={placeholder}
          className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm h-8 px-1"
          data-testid="inline-task-input"
        />
        {suggestion.type && suggestions.length > 0 && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-card border rounded-md shadow-lg p-1 min-w-[180px] max-h-48 overflow-auto" style={{ backgroundColor: 'hsl(var(--card))' }} data-testid="suggestion-popover">
            {suggestions.map((item, index) => (
              <div
                key={item.id || item.value}
                className={`px-2 py-1.5 text-sm rounded cursor-pointer flex items-center gap-2 ${
                  index === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover-elevate'
                }`}
                onClick={() => insertSuggestion(item)}
                data-testid={`suggestion-${item.id || item.value}`}
              >
                {suggestion.type === 'project' && <FolderKanban className="h-3 w-3 text-muted-foreground" />}
                {suggestion.type === 'person' && <User className="h-3 w-3 text-muted-foreground" />}
                {suggestion.type === 'status' && (
                  <span className={`h-2 w-2 rounded-full ${statusColors[item.value] || 'bg-gray-400'}`} />
                )}
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface InlineAssigneePanelProps {
  task: Task;
  people: Person[];
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onClose: () => void;
  depth: number;
}

function InlineAssigneePanel({ task, people, onUpdate, onClose, depth }: InlineAssigneePanelProps) {
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstButtonRef.current?.focus();
  }, []);

  return (
    <div 
      className="ml-8 p-3 border-l-2 border-primary/20 bg-muted/30 rounded-r"
      style={{ marginLeft: depth > 0 ? `${depth * 24 + 32}px` : '32px' }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Assign People</span>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-5 w-5"
          onClick={onClose}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      <div className="space-y-1 max-h-48 overflow-auto">
        {people.map((person, idx) => {
          const roles = person.roles || [];
          const isLead = roles.includes('lead') || roles.includes('project-lead');
          const isMember = roles.includes('member') || roles.includes('team-member');
          const roleLabel = isLead && isMember ? '(Lead/Member)' : isLead ? '(Lead)' : isMember ? '(Member)' : '';
          const isSelected = task.assignedTo?.includes(person.id);
          return (
            <button
              key={person.id}
              ref={idx === 0 ? firstButtonRef : undefined}
              onClick={() => {
                const newIds = isSelected 
                  ? (task.assignedTo || []).filter(id => id !== person.id)
                  : [...(task.assignedTo || []), person.id];
                onUpdate(task.id, { assignedTo: newIds });
              }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover-elevate ${isSelected ? 'bg-primary/10' : ''}`}
            >
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">{getInitials(person.name)}</AvatarFallback>
              </Avatar>
              <span className="flex-1 text-left truncate">{person.name}</span>
              <span className="text-xs text-muted-foreground">{roleLabel}</span>
              {isSelected && <Check className="h-4 w-4 text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface InlineDueDatePanelProps {
  task: Task;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onClose: () => void;
  depth: number;
}

function InlineDueDatePanel({ task, onUpdate, onClose, depth }: InlineDueDatePanelProps) {
  return (
    <div 
      className="ml-8 p-3 border-l-2 border-primary/20 bg-muted/30 rounded-r"
      style={{ marginLeft: depth > 0 ? `${depth * 24 + 32}px` : '32px' }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Set Due Date</span>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-5 w-5"
          onClick={onClose}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      <Calendar
        mode="single"
        selected={task.dueDate ? new Date(task.dueDate) : undefined}
        onSelect={(d) => {
          onUpdate(task.id, { dueDate: d ? format(d, 'yyyy-MM-dd') : null });
          onClose();
        }}
        initialFocus
      />
      {task.dueDate && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full text-destructive mt-2"
          onClick={() => { onUpdate(task.id, { dueDate: null }); onClose(); }}
        >
          Clear date
        </Button>
      )}
    </div>
  );
}

interface InlineNotesPanelProps {
  notes: TaskNote[];
  onAddNote: (content: string) => void;
  onClose: () => void;
  depth: number;
}

function InlineNotesPanel({ notes, onAddNote, onClose, depth }: InlineNotesPanelProps) {
  const [newNote, setNewNote] = useState('');

  const handleAdd = () => {
    if (newNote.trim()) {
      onAddNote(newNote.trim());
      setNewNote('');
    }
  };

  return (
    <div 
      className="ml-8 p-3 border-l-2 border-primary/20 bg-muted/30 rounded-r"
      style={{ marginLeft: depth > 0 ? `${depth * 24 + 32}px` : '32px' }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Notes</span>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-5 w-5"
          onClick={onClose}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      
      {notes.length > 0 && (
        <div className="space-y-2 max-h-40 overflow-auto mb-3">
          {notes.map((note, i) => (
            <div key={i} className="text-xs p-2 bg-background rounded border">
              <div className="text-muted-foreground mb-1">
                {note.author} - {format(new Date(note.timestamp), 'MMM d, h:mm a')}
              </div>
              <div>{note.content}</div>
            </div>
          ))}
        </div>
      )}
      
      <div className="space-y-2">
        <Textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note..."
          className="min-h-[60px] text-sm"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
              handleAdd();
            }
          }}
        />
        <Button size="sm" onClick={handleAdd} disabled={!newNote.trim()}>
          Add Note
        </Button>
      </div>
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
  onCreateSubtask: (parentId: string, title: string, parsed: ParsedTitle) => void;
  onIndent?: (taskId: string) => void;
  onOutdent?: (taskId: string) => void;
  depth?: number;
  userEmail: string;
  hideProjectBadge?: boolean;
}

function TaskRow({ 
  task, 
  allTasks, 
  projects, 
  people, 
  onUpdate, 
  onDelete, 
  onCreateSubtask,
  onIndent,
  onOutdent,
  depth = 0,
  userEmail,
  hideProjectBadge = false
}: TaskRowProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [suggestion, setSuggestion] = useState<SuggestionState>({ type: null, startIndex: 0, query: '' });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activePanel, setActivePanel] = useState<'assignee' | 'dueDate' | 'notes' | null>(null);
  const [panelTrigger, setPanelTrigger] = useState<'notes' | 'assignee' | 'menu' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const notesButtonRef = useRef<HTMLButtonElement>(null);
  const assigneeButtonRef = useRef<HTMLButtonElement>(null);

  const openPanel = (panel: 'assignee' | 'dueDate' | 'notes', trigger: 'notes' | 'assignee' | 'menu') => {
    setActivePanel(panel);
    setPanelTrigger(trigger);
  };

  const closePanel = () => {
    setActivePanel(null);
    if (panelTrigger === 'notes') {
      notesButtonRef.current?.focus();
    } else if (panelTrigger === 'assignee') {
      assigneeButtonRef.current?.focus();
    } else {
      menuButtonRef.current?.focus();
    }
    setPanelTrigger(null);
  };

  const subtasks = allTasks.filter(t => t.parentTaskId === task.id);
  const hasSubtasks = subtasks.length > 0;
  const project = task.projectId ? projects.find(p => p.id === task.projectId) : null;
  const assignees = people.filter(p => task.assignedTo?.includes(p.id));
  const notes = (task.notes || []) as TaskNote[];
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate)) && task.status !== 'done';

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const detectTrigger = (text: string, cursorPos: number): SuggestionState => {
    const beforeCursor = text.slice(0, cursorPos);
    const projectMatch = beforeCursor.match(/@@(\w*)$/);
    if (projectMatch) {
      return { type: 'project', startIndex: projectMatch.index!, query: projectMatch[1] };
    }
    const personMatch = beforeCursor.match(/(?<![@@])@(\w*)$/);
    if (personMatch) {
      return { type: 'person', startIndex: personMatch.index!, query: personMatch[1] };
    }
    const statusMatch = beforeCursor.match(/#(\w*)$/);
    if (statusMatch) {
      return { type: 'status', startIndex: statusMatch.index!, query: statusMatch[1] };
    }
    return { type: null, startIndex: 0, query: '' };
  };

  const getEditSuggestions = (): { value: string; label: string; id?: string }[] => {
    if (suggestion.type === 'project') {
      return projects
        .filter(p => p.name.toLowerCase().includes(suggestion.query.toLowerCase()))
        .slice(0, 8)
        .map(p => ({ value: p.name.replace(/\s+/g, ''), label: p.name, id: p.id }));
    }
    if (suggestion.type === 'person') {
      const getEditPersonRoleLabel = (person: Person): string => {
        const roles = person.roles || [];
        const isLead = roles.includes('lead') || roles.includes('project-lead');
        const isMember = roles.includes('member') || roles.includes('team-member');
        if (isLead && isMember) return `${person.name} (Lead/Member)`;
        if (isLead) return `${person.name} (Lead)`;
        if (isMember) return `${person.name} (Member)`;
        return person.name;
      };
      return people
        .filter(p => p.name.toLowerCase().includes(suggestion.query.toLowerCase()))
        .slice(0, 8)
        .map(p => ({ value: p.name.split(' ')[0], label: getEditPersonRoleLabel(p), id: p.id }));
    }
    if (suggestion.type === 'status') {
      return STATUS_OPTIONS.filter(s => 
        s.label.toLowerCase().includes(suggestion.query.toLowerCase()) ||
        s.value.toLowerCase().includes(suggestion.query.toLowerCase())
      );
    }
    return [];
  };

  const editSuggestions = getEditSuggestions();

  const insertEditSuggestion = (item: { value: string; label: string }) => {
    const prefix = suggestion.type === 'project' ? '@@' : suggestion.type === 'person' ? '@' : '#';
    const beforeTrigger = editValue.slice(0, suggestion.startIndex);
    const afterCursor = editValue.slice(suggestion.startIndex + prefix.length + suggestion.query.length);
    const newValue = beforeTrigger + prefix + item.value + ' ' + afterCursor;
    setEditValue(newValue.trim() + ' ');
    setSuggestion({ type: null, startIndex: 0, query: '' });
    setSelectedIndex(0);
    inputRef.current?.focus();
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setEditValue(newValue);
    setSuggestion(detectTrigger(newValue, cursorPos));
    setSelectedIndex(0);
  };

  const handleCycleStatus = () => {
    const currentIndex = STATUS_CYCLE.indexOf(task.status);
    const nextIndex = (currentIndex + 1) % STATUS_CYCLE.length;
    onUpdate(task.id, { status: STATUS_CYCLE[nextIndex] });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (suggestion.type && editSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => (i + 1) % editSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => (i - 1 + editSuggestions.length) % editSuggestions.length);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        insertEditSuggestion(editSuggestions[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSuggestion({ type: null, startIndex: 0, query: '' });
        return;
      }
    }

    if (e.key === 'Enter') {
      if (suggestion.type && editSuggestions.length > 0) {
        e.preventDefault();
        insertEditSuggestion(editSuggestions[selectedIndex]);
        return;
      }
      if (editValue.trim()) {
        const parsed = parseInlineTags(editValue.trim());
        const updates: Partial<Task> = { title: parsed.text || editValue.trim() };
        
        if (parsed.statusTag) {
          updates.status = parsed.statusTag;
        }
        if (parsed.projectTag) {
          const matchedProject = projects.find(p => 
            p.name.toLowerCase().replace(/\s+/g, '').includes(parsed.projectTag!.toLowerCase()) ||
            p.name.toLowerCase().includes(parsed.projectTag!.toLowerCase())
          );
          if (matchedProject) {
            updates.projectId = matchedProject.id;
          }
        }
        if (parsed.personTags.length > 0) {
          const matchedPeople = people.filter(p => 
            parsed.personTags.some(tag => 
              p.name.toLowerCase().includes(tag.toLowerCase()) ||
              p.name.split(' ')[0].toLowerCase() === tag.toLowerCase()
            )
          );
          if (matchedPeople.length > 0) {
            const existingAssignees = task.assignedTo || [];
            const newAssigneeIds = matchedPeople.map(p => p.id);
            const mergedAssignees = Array.from(new Set([...existingAssignees, ...newAssigneeIds]));
            updates.assignedTo = mergedAssignees;
          }
        }
        if (parsed.noteText) {
          const newNote: TaskNote = {
            content: parsed.noteText,
            author: userEmail,
            timestamp: new Date().toISOString(),
          };
          updates.notes = [...notes, newNote];
        }
        
        onUpdate(task.id, updates);
      }
      setIsEditing(false);
      setSuggestion({ type: null, startIndex: 0, query: '' });
    }
    if (e.key === 'Escape' && !suggestion.type) {
      setEditValue(task.title);
      setIsEditing(false);
    }
    if (e.key === 'Tab' && (!suggestion.type || editSuggestions.length === 0)) {
      e.preventDefault();
      if (e.shiftKey && onOutdent) {
        onOutdent(task.id);
      } else if (!e.shiftKey) {
        setShowSubtaskInput(true);
      }
    }
  };

  const handleAddNote = (content: string) => {
    const newNote: TaskNote = {
      content,
      author: userEmail,
      timestamp: new Date().toISOString(),
    };
    onUpdate(task.id, { notes: [...notes, newNote] });
  };

  const handleSubtaskCreate = (title: string, parsed: ParsedTitle) => {
    onCreateSubtask(task.id, title, parsed);
    setShowSubtaskInput(false);
  };

  return (
    <div data-testid={`task-row-${task.id}`} className={`relative ${isEditing ? 'z-50' : ''}`}>
      <div 
        className={`group flex items-center gap-2 py-1.5 rounded hover-elevate ${isOverdue ? 'bg-destructive/5' : ''}`}
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
          <StatusIcon 
            status={task.status} 
            onClick={handleCycleStatus}
            taskId={task.id}
          />
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          {isEditing ? (
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                value={editValue}
                onChange={handleEditChange}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  setTimeout(() => {
                    setSuggestion({ type: null, startIndex: 0, query: '' });
                    if (editValue.trim() && editValue !== task.title) {
                      const parsed = parseInlineTags(editValue.trim());
                      onUpdate(task.id, { title: parsed.text || editValue.trim() });
                    }
                    setIsEditing(false);
                  }, 150);
                }}
                className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm h-7 px-1"
                data-testid={`edit-input-${task.id}`}
              />
              {suggestion.type && editSuggestions.length > 0 && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-card border rounded-md shadow-lg p-1 min-w-[180px] max-h-48 overflow-auto" style={{ backgroundColor: 'hsl(var(--card))' }} data-testid="edit-suggestion-popover">
                  {editSuggestions.map((item, index) => (
                    <div
                      key={item.id || item.value}
                      className={`px-2 py-1.5 text-sm rounded cursor-pointer flex items-center gap-2 ${
                        index === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover-elevate'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        insertEditSuggestion(item);
                      }}
                      data-testid={`edit-suggestion-${item.id || item.value}`}
                    >
                      {suggestion.type === 'project' && <FolderKanban className="h-3 w-3 text-muted-foreground" />}
                      {suggestion.type === 'person' && <User className="h-3 w-3 text-muted-foreground" />}
                      {suggestion.type === 'status' && (
                        <span className={`h-2 w-2 rounded-full ${statusColors[item.value] || 'bg-gray-400'}`} />
                      )}
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span 
              className={`text-sm cursor-text flex-1 ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}
              onClick={() => setIsEditing(true)}
              data-testid={`task-title-${task.id}`}
            >
              {task.title}
            </span>
          )}
          
          <button
            ref={assigneeButtonRef}
            onClick={() => activePanel === 'assignee' ? closePanel() : openPanel('assignee', 'assignee')}
            className="text-xs text-muted-foreground truncate max-w-[150px] hover:text-foreground hover:underline cursor-pointer"
            title="Click to assign people"
            data-testid={`assignee-trigger-${task.id}`}
          >
            {assignees.length > 0 ? assignees.map(p => p.name).join(', ') : '+assign'}
          </button>
          
          {project && !hideProjectBadge && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 gap-1 flex-shrink-0">
              <FolderKanban className="h-2.5 w-2.5" />
              {project.name}
            </Badge>
          )}
          
          {task.dueDate && (
            <Badge variant={isOverdue ? "destructive" : "secondary"} className="text-xs px-1.5 py-0 h-5 flex-shrink-0">
              {format(new Date(task.dueDate), 'MMM d')}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          <button
            ref={notesButtonRef}
            onClick={() => activePanel === 'notes' ? closePanel() : openPanel('notes', 'notes')}
            className={`p-1 hover:bg-accent rounded relative ${notes.length > 0 ? 'text-primary' : 'text-muted-foreground'}`}
            title={notes.length > 0 ? `${notes.length} note(s) - Click to view/add` : "Add note"}
            data-testid={`notes-icon-${task.id}`}
          >
            <StickyNote className="h-3.5 w-3.5" />
            {notes.length > 0 && (
              <span className="absolute -top-1 -right-1 text-[8px] bg-primary text-primary-foreground rounded-full h-3 w-3 flex items-center justify-center">
                {notes.length}
              </span>
            )}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                ref={menuButtonRef}
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`task-menu-${task.id}`}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => openPanel('dueDate', 'menu')} data-testid="menu-due-date">
                <CalendarIcon className="h-4 w-4 mr-2" />
                Set Due Date
                {task.dueDate && <span className="ml-auto text-xs text-muted-foreground">{format(new Date(task.dueDate), 'MMM d')}</span>}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onDelete(task.id)} 
                className="text-destructive focus:text-destructive"
                data-testid={`delete-${task.id}`}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {activePanel === 'assignee' && (
        <InlineAssigneePanel
          task={task}
          people={people}
          onUpdate={onUpdate}
          onClose={closePanel}
          depth={depth}
        />
      )}

      {activePanel === 'dueDate' && (
        <InlineDueDatePanel
          task={task}
          onUpdate={onUpdate}
          onClose={closePanel}
          depth={depth}
        />
      )}

      {activePanel === 'notes' && (
        <InlineNotesPanel
          notes={notes}
          onAddNote={handleAddNote}
          onClose={closePanel}
          depth={depth}
        />
      )}

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
              onIndent={onIndent}
              onOutdent={onOutdent}
              depth={depth + 1}
              userEmail={userEmail}
              hideProjectBadge={hideProjectBadge}
            />
          ))}
        </div>
      )}

      {showSubtaskInput && (
        <InlineTaskInput
          onSubmit={handleSubtaskCreate}
          onCancel={() => setShowSubtaskInput(false)}
          placeholder="Add sub-task... (@@project @person #status)"
          autoFocus
          depth={depth + 1}
          projects={projects}
          people={people}
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

  const handleCreateTask = (title: string, parsed: ParsedTitle, parentTaskId?: string) => {
    const taskData: Partial<Task> = { 
      title: parsed.text || title, 
      parentTaskId: parentTaskId || undefined,
      status: parsed.statusTag || 'todo',
      priority: 'medium',
      assignedTo: [],
    };
    
    if (parsed.projectTag) {
      const matchedProject = projects.find(p => 
        p.name.toLowerCase().replace(/\s+/g, '').includes(parsed.projectTag!.toLowerCase()) ||
        p.name.toLowerCase().includes(parsed.projectTag!.toLowerCase())
      );
      if (matchedProject) taskData.projectId = matchedProject.id;
    }
    
    if (parsed.personTags.length > 0) {
      const matchedPeople = people.filter(p => 
        parsed.personTags.some(tag => 
          p.name.toLowerCase().includes(tag.toLowerCase()) ||
          p.name.split(' ')[0].toLowerCase() === tag.toLowerCase()
        )
      );
      if (matchedPeople.length > 0) {
        taskData.assignedTo = matchedPeople.map(p => p.id);
      }
    }
    
    if (parsed.noteText) {
      taskData.notes = [{
        content: parsed.noteText,
        author: userEmail,
        timestamp: new Date().toISOString(),
      }];
    }
    
    createTaskMutation.mutate(taskData);
  };

  const handleUpdateTask = (id: string, updates: Partial<Task>) => {
    updateTaskMutation.mutate({ id, updates });
  };

  const handleDeleteTask = (id: string) => {
    deleteTaskMutation.mutate(id);
  };

  const handleIndent = (taskId: string) => {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    
    const siblings = myRootTasks.filter(t => t.parentTaskId === task.parentTaskId);
    const taskIndex = siblings.findIndex(t => t.id === taskId);
    
    if (taskIndex > 0) {
      const newParent = siblings[taskIndex - 1];
      handleUpdateTask(taskId, { parentTaskId: newParent.id });
    }
  };

  const handleOutdent = (taskId: string) => {
    const task = allTasks.find(t => t.id === taskId);
    if (!task || !task.parentTaskId) return;
    
    const parent = allTasks.find(t => t.id === task.parentTaskId);
    if (parent) {
      handleUpdateTask(taskId, { parentTaskId: parent.parentTaskId || undefined });
    }
  };

  const [leadFilter, setLeadFilter] = useState<string>('all');

  // Get unique leads from projects
  const projectLeads = useMemo(() => {
    const leadIds = new Set<string>();
    projects.forEach(p => {
      if (p.leadId) leadIds.add(p.leadId);
      if (p.leadIds) p.leadIds.forEach(id => leadIds.add(id));
    });
    return people.filter(p => leadIds.has(p.id));
  }, [projects, people]);

  const projectsWithTasks = projects.filter(p => {
    const hasTasks = allTasks.some(t => t.projectId === p.id);
    if (!hasTasks) return false;
    if (leadFilter === 'all') return true;
    return p.leadId === leadFilter || (p.leadIds && p.leadIds.includes(leadFilter));
  });

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
          <p className="text-xs text-muted-foreground mt-1">
            Use @@project to link, @name to assign, #status to set status, // for notes. Press TAB on a task to create a sub-task.
          </p>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg bg-card">
            <InlineTaskInput 
              onSubmit={(title, parsed) => handleCreateTask(title, parsed)} 
              placeholder="Type a task... (@@project @person #status //note)"
              autoFocus
              projects={projects}
              people={people}
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
                    onCreateSubtask={(parentId, title, parsed) => handleCreateTask(title, parsed, parentId)}
                    onIndent={handleIndent}
                    onOutdent={handleOutdent}
                    userEmail={userEmail}
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
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FolderKanban className="h-5 w-5" />
              All Tasks by Project
            </CardTitle>
            <Select value={leadFilter} onValueChange={setLeadFilter}>
              <SelectTrigger className="w-[200px] h-8" data-testid="lead-filter">
                <SelectValue placeholder="Filter by Lead" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leads</SelectItem>
                {projectLeads.map(lead => (
                  <SelectItem key={lead.id} value={lead.id}>{lead.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
                const activeTasks = projectTasks.filter(t => t.status === 'todo' || t.status === 'in-progress');
                const blockedTasks = projectTasks.filter(t => t.status === 'blocked');
                const closedTasks = projectTasks.filter(t => t.status === 'done');
                
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
                      <div className="border rounded-lg mt-2 bg-card space-y-2 p-2">
                        {activeTasks.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">
                              <Play className="h-3 w-3" />
                              To-do / In-progress ({activeTasks.length})
                            </div>
                            <div className="border rounded-md bg-background">
                              {activeTasks.map(task => (
                                <TaskRow
                                  key={task.id}
                                  task={task}
                                  allTasks={allTasks}
                                  projects={projects}
                                  people={people}
                                  onUpdate={handleUpdateTask}
                                  onDelete={handleDeleteTask}
                                  onCreateSubtask={(parentId, title, parsed) => handleCreateTask(title, parsed, parentId)}
                                  onIndent={handleIndent}
                                  onOutdent={handleOutdent}
                                  userEmail={userEmail}
                                  hideProjectBadge={true}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {blockedTasks.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-destructive">
                              <Ban className="h-3 w-3" />
                              Blockers ({blockedTasks.length})
                            </div>
                            <div className="border border-destructive/30 rounded-md bg-destructive/5">
                              {blockedTasks.map(task => (
                                <TaskRow
                                  key={task.id}
                                  task={task}
                                  allTasks={allTasks}
                                  projects={projects}
                                  people={people}
                                  onUpdate={handleUpdateTask}
                                  onDelete={handleDeleteTask}
                                  onCreateSubtask={(parentId, title, parsed) => handleCreateTask(title, parsed, parentId)}
                                  onIndent={handleIndent}
                                  onOutdent={handleOutdent}
                                  userEmail={userEmail}
                                  hideProjectBadge={true}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {closedTasks.length > 0 && (
                          <Collapsible defaultOpen={false}>
                            <CollapsibleTrigger className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground w-full text-left">
                              <ChevronRight className="h-3 w-3" />
                              <Check className="h-3 w-3" />
                              Closed ({closedTasks.length})
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="border rounded-md bg-muted/30">
                                {closedTasks.map(task => (
                                  <TaskRow
                                    key={task.id}
                                    task={task}
                                    allTasks={allTasks}
                                    projects={projects}
                                    people={people}
                                    onUpdate={handleUpdateTask}
                                    onDelete={handleDeleteTask}
                                    onCreateSubtask={(parentId, title, parsed) => handleCreateTask(title, parsed, parentId)}
                                    onIndent={handleIndent}
                                    onOutdent={handleOutdent}
                                    userEmail={userEmail}
                                    hideProjectBadge={true}
                                  />
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}

              {tasksWithoutProject.length > 0 && (() => {
                const activeUnassigned = tasksWithoutProject.filter(t => t.status === 'todo' || t.status === 'in-progress');
                const blockedUnassigned = tasksWithoutProject.filter(t => t.status === 'blocked');
                const closedUnassigned = tasksWithoutProject.filter(t => t.status === 'done');
                
                return (
                  <Collapsible defaultOpen>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded-lg hover-elevate text-left">
                      <ChevronDown className="h-4 w-4" />
                      <Circle className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm text-muted-foreground">Project unassigned/general</span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {tasksWithoutProject.length}
                      </Badge>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border rounded-lg mt-2 bg-card space-y-2 p-2">
                        {activeUnassigned.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">
                              <Play className="h-3 w-3" />
                              To-do / In-progress ({activeUnassigned.length})
                            </div>
                            <div className="border rounded-md bg-background">
                              {activeUnassigned.map(task => (
                                <TaskRow
                                  key={task.id}
                                  task={task}
                                  allTasks={allTasks}
                                  projects={projects}
                                  people={people}
                                  onUpdate={handleUpdateTask}
                                  onDelete={handleDeleteTask}
                                  onCreateSubtask={(parentId, title, parsed) => handleCreateTask(title, parsed, parentId)}
                                  onIndent={handleIndent}
                                  onOutdent={handleOutdent}
                                  userEmail={userEmail}
                                  hideProjectBadge={true}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {blockedUnassigned.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-destructive">
                              <Ban className="h-3 w-3" />
                              Blockers ({blockedUnassigned.length})
                            </div>
                            <div className="border border-destructive/30 rounded-md bg-destructive/5">
                              {blockedUnassigned.map(task => (
                                <TaskRow
                                  key={task.id}
                                  task={task}
                                  allTasks={allTasks}
                                  projects={projects}
                                  people={people}
                                  onUpdate={handleUpdateTask}
                                  onDelete={handleDeleteTask}
                                  onCreateSubtask={(parentId, title, parsed) => handleCreateTask(title, parsed, parentId)}
                                  onIndent={handleIndent}
                                  onOutdent={handleOutdent}
                                  userEmail={userEmail}
                                  hideProjectBadge={true}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {closedUnassigned.length > 0 && (
                          <Collapsible defaultOpen={false}>
                            <CollapsibleTrigger className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground w-full text-left">
                              <ChevronRight className="h-3 w-3" />
                              <Check className="h-3 w-3" />
                              Closed ({closedUnassigned.length})
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="border rounded-md bg-muted/30">
                                {closedUnassigned.map(task => (
                                  <TaskRow
                                    key={task.id}
                                    task={task}
                                    allTasks={allTasks}
                                    projects={projects}
                                    people={people}
                                    onUpdate={handleUpdateTask}
                                    onDelete={handleDeleteTask}
                                    onCreateSubtask={(parentId, title, parsed) => handleCreateTask(title, parsed, parentId)}
                                    onIndent={handleIndent}
                                    onOutdent={handleOutdent}
                                    userEmail={userEmail}
                                    hideProjectBadge={true}
                                  />
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
