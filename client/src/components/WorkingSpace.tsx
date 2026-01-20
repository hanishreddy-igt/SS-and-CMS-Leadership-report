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
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { format, isPast, isToday, formatDistanceToNow } from 'date-fns';
import { 
  Plus,
  Minus,
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
  Ban
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Task, Project, Person } from '@shared/schema';

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

const statusColors: Record<string, string> = {
  todo: 'bg-slate-500',
  'in-progress': 'bg-green-500',
  blocked: 'bg-red-500',
  done: 'bg-blue-500',
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

const STATUS_CYCLE = ['todo', 'in-progress', 'done'];

function StatusIcon({ status, onClick, taskId, disabled }: { status: string; onClick: () => void; taskId?: string; disabled?: boolean }) {
  const iconClass = disabled ? "h-4 w-4 transition-colors opacity-60" : "h-4 w-4 cursor-pointer transition-colors";
  const testId = taskId ? `status-${taskId}` : 'status-icon';
  const disabledTitle = "Status auto-managed by sub-tasks";
  
  switch (status) {
    case 'todo':
      return disabled ? (
        <div className="p-0.5" title={disabledTitle} data-testid={testId}>
          <Circle className={`${iconClass} text-slate-400`} />
        </div>
      ) : (
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
      return disabled ? (
        <div className="p-0.5" title={disabledTitle} data-testid={testId}>
          <Play className={`${iconClass} text-green-500 fill-green-500`} />
        </div>
      ) : (
        <button 
          onClick={onClick} 
          className="p-0.5 hover:bg-accent rounded" 
          title="In Progress - Click to mark done"
          aria-label="Status: In Progress. Click to change to Done"
          data-testid={testId}
        >
          <Play className={`${iconClass} text-green-500 fill-green-500`} />
        </button>
      );
    case 'blocked':
      return (
        <div 
          className="p-0.5" 
          title={disabled ? disabledTitle : "Blocked"}
          data-testid={testId}
        >
          <Ban className={`h-4 w-4 text-red-500 ${disabled ? 'opacity-60' : ''}`} />
        </div>
      );
    case 'done':
      return (
        <div 
          className="p-0.5" 
          title={disabled ? disabledTitle : "Done"}
          data-testid={testId}
        >
          <Check className={`h-4 w-4 text-blue-500 ${disabled ? 'opacity-60' : ''}`} />
        </div>
      );
    default:
      return disabled ? (
        <div className="p-0.5" title={disabledTitle} data-testid={testId}>
          <Circle className={`${iconClass} text-slate-400`} />
        </div>
      ) : (
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

export interface ParsedTitle {
  text: string;
  projectTag?: string;
  personTags: string[];
  statusTag?: string;
  priorityTag?: string;
  noteText?: string;
  dueDate?: string; // ISO date string
}

const priorityColors: Record<string, string> = {
  normal: 'bg-green-500',
  medium: 'bg-yellow-500',
  high: 'bg-red-500',
};

const priorityLabels: Record<string, string> = {
  normal: 'Normal',
  medium: 'Medium',
  high: 'High',
};

const PRIORITY_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export function parseInlineTags(title: string): ParsedTitle {
  const result: ParsedTitle = { text: title, personTags: [] };
  
  const noteMatch = title.match(/\/\/(.+?)(?=@@|@(?!@)|#|\$|$)/);
  if (noteMatch) {
    result.noteText = noteMatch[1].trim();
    result.text = result.text.replace(/\/\/.+?(?=@@|@(?!@)|#|\$|$)/, '').trim();
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
  
  // Parse priority tag ($normal, $medium, $high)
  const priorityMatch = title.match(/\$(normal|medium|high)/i);
  if (priorityMatch) {
    result.priorityTag = priorityMatch[1].toLowerCase();
    result.text = result.text.replace(/\$(normal|medium|high)/gi, '').trim();
  }
  
  // Parse due date tag (!date)
  // Supported formats: !today, !tomorrow, !1/17, !01/17, !Jan17, !Jan 17, !January17, !January 17
  const monthNames: Record<string, number> = {
    'jan': 0, 'january': 0, 'feb': 1, 'february': 1, 'mar': 2, 'march': 2,
    'apr': 3, 'april': 3, 'may': 4, 'jun': 5, 'june': 5,
    'jul': 6, 'july': 6, 'aug': 7, 'august': 7, 'sep': 8, 'september': 8,
    'oct': 9, 'october': 9, 'nov': 10, 'november': 10, 'dec': 11, 'december': 11
  };
  
  // Try different date patterns
  const dueDatePatterns = [
    // !today, !tomorrow
    /!(today|tomorrow)\b/i,
    // !1/17 or !01/17 (m/d or mm/dd)
    /!(\d{1,2})\/(\d{1,2})\b/,
    // !Jan17 or !Jan 17 or !January17 or !January 17
    /!(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{1,2})\b/i
  ];
  
  // Helper to format date as YYYY-MM-DD without timezone conversion
  const formatDateString = (year: number, month: number, day: number): string => {
    const y = year.toString();
    const m = (month + 1).toString().padStart(2, '0'); // month is 0-indexed
    const d = day.toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  
  for (const pattern of dueDatePatterns) {
    const dueDateMatch = title.match(pattern);
    if (dueDateMatch) {
      const now = new Date();
      let dateString: string | null = null;
      
      if (pattern === dueDatePatterns[0]) {
        // today/tomorrow
        const keyword = dueDateMatch[1].toLowerCase();
        const targetDate = new Date(now);
        if (keyword === 'tomorrow') {
          targetDate.setDate(targetDate.getDate() + 1);
        }
        dateString = formatDateString(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      } else if (pattern === dueDatePatterns[1]) {
        // m/d format
        const month = parseInt(dueDateMatch[1], 10) - 1; // 0-indexed
        const day = parseInt(dueDateMatch[2], 10);
        let year = now.getFullYear();
        // If the date has passed, assume next year
        const targetDate = new Date(year, month, day);
        if (targetDate < now) {
          year++;
        }
        dateString = formatDateString(year, month, day);
      } else if (pattern === dueDatePatterns[2]) {
        // Month name + day
        const monthName = dueDateMatch[1].toLowerCase();
        const day = parseInt(dueDateMatch[2], 10);
        const monthIndex = monthNames[monthName.substring(0, 3)];
        if (monthIndex !== undefined) {
          let year = now.getFullYear();
          // If the date has passed, assume next year
          const targetDate = new Date(year, monthIndex, day);
          if (targetDate < now) {
            year++;
          }
          dateString = formatDateString(year, monthIndex, day);
        }
      }
      
      if (dateString) {
        result.dueDate = dateString;
        result.text = result.text.replace(pattern, '').trim();
      }
      break;
    }
  }
  
  // Clean up any orphaned tag prefixes (@@, @, #, $, !, //) that weren't matched
  result.text = result.text
    .replace(/@@\s*/g, '')  // Remove orphaned @@
    .replace(/@\s*/g, '')   // Remove orphaned @
    .replace(/#\s*/g, '')   // Remove orphaned #
    .replace(/\$\s*/g, '')  // Remove orphaned $
    .replace(/!\s*/g, '')   // Remove orphaned !
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
  type: 'project' | 'person' | 'status' | 'priority' | null;
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
  placeholder = "Type a task... (@@account @person #status $priority !date //note)", 
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
    
    const priorityMatch = beforeCursor.match(/\$(\w*)$/);
    if (priorityMatch) {
      return { type: 'priority', startIndex: priorityMatch.index!, query: priorityMatch[1] };
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

  // Helper to determine if a project is active
  const isProjectActive = (endDate: string | null | undefined): boolean => {
    if (!endDate) return true; // No end date = active
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return end >= today;
  };

  const getSuggestions = (): { value: string; label: string; id?: string }[] => {
    if (suggestion.type === 'project') {
      return projects
        .filter(p => isProjectActive(p.endDate) && p.name.toLowerCase().includes(suggestion.query.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 8)
        .map(p => ({ value: p.name.replace(/\s+/g, ''), label: p.name, id: p.id }));
    }
    if (suggestion.type === 'person') {
      const taggedProject = getTaggedProject();
      const availablePeople = taggedProject ? getProjectPeople(taggedProject) : people;
      return availablePeople
        .filter(p => p.name.toLowerCase().includes(suggestion.query.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 8)
        .map(p => ({ value: p.name.split(' ')[0], label: getPersonRoleLabel(p), id: p.id }));
    }
    if (suggestion.type === 'status') {
      return STATUS_OPTIONS.filter(s => 
        s.label.toLowerCase().includes(suggestion.query.toLowerCase()) ||
        s.value.toLowerCase().includes(suggestion.query.toLowerCase())
      );
    }
    if (suggestion.type === 'priority') {
      return PRIORITY_OPTIONS.filter(p => 
        p.label.toLowerCase().includes(suggestion.query.toLowerCase()) ||
        p.value.toLowerCase().includes(suggestion.query.toLowerCase())
      );
    }
    return [];
  };

  const suggestions = getSuggestions();

  const insertSuggestion = (item: { value: string; label: string }) => {
    const prefix = suggestion.type === 'project' ? '@@' : suggestion.type === 'person' ? '@' : suggestion.type === 'priority' ? '$' : '#';
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
    if (e.key === 'Backspace' && value === '' && onCancel) {
      e.preventDefault();
      onCancel();
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
                {suggestion.type === 'priority' && (
                  <span className={`h-2 w-2 rounded-full ${priorityColors[item.value] || 'bg-gray-400'}`} />
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
        {[...people]
          .sort((a, b) => {
            const aSelected = task.assignedTo?.includes(a.id) ? 0 : 1;
            const bSelected = task.assignedTo?.includes(b.id) ? 0 : 1;
            if (aSelected !== bSelected) return aSelected - bSelected;
            return a.name.localeCompare(b.name);
          })
          .map((person, idx) => {
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

export interface TaskRowProps {
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
  hiddenAssigneeIds?: string[];
  showDetailsToggle?: boolean;
  openTaskId?: string | null;
  onOpenDetails?: (taskId: string | null) => void;
}

export function TaskRow({ 
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
  hideProjectBadge = false,
  hiddenAssigneeIds = [],
  showDetailsToggle = false,
  openTaskId,
  onOpenDetails
}: TaskRowProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [suggestion, setSuggestion] = useState<SuggestionState>({ type: null, startIndex: 0, query: '' });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activePanel, setActivePanel] = useState<'assignee' | 'dueDate' | 'notes' | null>(null);
  const [panelTrigger, setPanelTrigger] = useState<'notes' | 'assignee' | 'menu' | null>(null);
  
  // Use external control if provided, otherwise fall back to always showing details
  const showDetails = showDetailsToggle ? (openTaskId === task.id) : true;
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
  
  // Helper to get all descendant tasks recursively
  const getAllDescendants = (taskId: string): Task[] => {
    const children = allTasks.filter(t => t.parentTaskId === taskId);
    return children.reduce((acc, child) => [...acc, child, ...getAllDescendants(child.id)], [] as Task[]);
  };
  
  // Calculate effective priority: highest priority among task and all descendants
  // Priority hierarchy: high > medium > normal
  const priorityRank: Record<string, number> = { normal: 0, medium: 1, high: 2 };
  const getEffectivePriority = (): string => {
    if (!hasSubtasks) return task.priority || 'normal';
    const descendants = getAllDescendants(task.id);
    const allPriorities = [task.priority || 'normal', ...descendants.map(d => d.priority || 'normal')];
    const highestRank = Math.max(...allPriorities.map(p => priorityRank[p] ?? 0));
    return Object.entries(priorityRank).find(([_, rank]) => rank === highestRank)?.[0] || 'normal';
  };
  const effectivePriority = getEffectivePriority();
  
  // For sub-tasks, inherit project from parent if not set
  const parentTask = task.parentTaskId ? allTasks.find(t => t.id === task.parentTaskId) : null;
  const effectiveProjectId = task.projectId || parentTask?.projectId;
  const project = effectiveProjectId ? projects.find(p => p.id === effectiveProjectId) : null;
  const isProjectInherited = !task.projectId && parentTask?.projectId;
  const assignees = people.filter(p => task.assignedTo?.includes(p.id));
  const displayAssignees = assignees.filter(p => !hiddenAssigneeIds.includes(p.id));
  const notes = (task.notes || []) as TaskNote[];
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate)) && task.status !== 'done';

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (!inputRef.current.value.endsWith(' ')) {
        inputRef.current.value = inputRef.current.value + ' ';
        setEditValue(inputRef.current.value);
      }
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
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
    const priorityMatch = beforeCursor.match(/\$(\w*)$/);
    if (priorityMatch) {
      return { type: 'priority', startIndex: priorityMatch.index!, query: priorityMatch[1] };
    }
    return { type: null, startIndex: 0, query: '' };
  };

  // Helper to determine if a project is active (for edit suggestions)
  const isEditProjectActive = (endDate: string | null | undefined): boolean => {
    if (!endDate) return true; // No end date = active
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return end >= today;
  };

  const getEditSuggestions = (): { value: string; label: string; id?: string }[] => {
    if (suggestion.type === 'project') {
      return projects
        .filter(p => isEditProjectActive(p.endDate) && p.name.toLowerCase().includes(suggestion.query.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name))
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
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 8)
        .map(p => ({ value: p.name.split(' ')[0], label: getEditPersonRoleLabel(p), id: p.id }));
    }
    if (suggestion.type === 'status') {
      return STATUS_OPTIONS.filter(s => 
        s.label.toLowerCase().includes(suggestion.query.toLowerCase()) ||
        s.value.toLowerCase().includes(suggestion.query.toLowerCase())
      );
    }
    if (suggestion.type === 'priority') {
      return PRIORITY_OPTIONS.filter(p => 
        p.label.toLowerCase().includes(suggestion.query.toLowerCase()) ||
        p.value.toLowerCase().includes(suggestion.query.toLowerCase())
      );
    }
    return [];
  };

  const editSuggestions = getEditSuggestions();

  const insertEditSuggestion = (item: { value: string; label: string }) => {
    const prefix = suggestion.type === 'project' ? '@@' : suggestion.type === 'person' ? '@' : suggestion.type === 'priority' ? '$' : '#';
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
    // Don't cycle if status is 'done' or 'blocked'
    if (task.status === 'done' || task.status === 'blocked') return;
    
    const currentIndex = STATUS_CYCLE.indexOf(task.status);
    const nextIndex = currentIndex + 1;
    if (nextIndex < STATUS_CYCLE.length) {
      onUpdate(task.id, { status: STATUS_CYCLE[nextIndex] });
    }
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
        if (parsed.priorityTag) {
          updates.priority = parsed.priorityTag;
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
        if (parsed.dueDate) {
          updates.dueDate = parsed.dueDate;
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
        className={`group py-1.5 rounded hover-elevate ${isOverdue ? 'bg-destructive/5' : ''}`}
        style={{ paddingLeft: depth > 0 ? `${depth * 24 + 8}px` : '8px', paddingRight: '8px' }}
      >
        {/* Line 1: Toggle, Status, Title, Notes, Menu */}
        <div className="flex items-center gap-2">
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
              disabled={hasSubtasks}
            />
          </div>

          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="relative">
                <Input
                  ref={inputRef}
                  value={editValue}
                  onChange={handleEditChange}
                  onKeyDown={handleKeyDown}
                  onBlur={() => {
                    setTimeout(() => {
                      setSuggestion({ type: null, startIndex: 0, query: '' });
                      setEditValue(task.title);
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
                        {suggestion.type === 'priority' && (
                          <span className={`h-2 w-2 rounded-full ${priorityColors[item.value] || 'bg-gray-400'}`} />
                        )}
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <span 
                className={`text-sm cursor-text block ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}
                onClick={() => {
                  setIsEditing(true);
                  if (showDetailsToggle && onOpenDetails) {
                    onOpenDetails(task.id);
                  }
                }}
                data-testid={`task-title-${task.id}`}
              >
                {task.title}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Due date badge - shown inline next to notes */}
            {task.dueDate && (
              <Badge 
                variant={isOverdue ? "destructive" : "secondary"} 
                className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0"
                data-testid={`due-date-inline-${task.id}`}
              >
                {format(new Date(task.dueDate), 'MMM d')}
              </Badge>
            )}
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
          </div>
        </div>

        {/* Line 2: Priority, Project, Assignees, Timestamps, Menu (Due date moved to line 1) */}
        {showDetails && (
          <div className="flex items-center gap-2 mt-1 ml-9">
            {/* Show effective priority for parent tasks (read-only), editable for leaf tasks */}
            {hasSubtasks ? (
              effectivePriority && effectivePriority !== 'normal' && (
                <Badge 
                  variant="secondary" 
                  className={`text-xs px-1.5 py-0 h-5 gap-1 flex-shrink-0 text-white ${priorityColors[effectivePriority] || 'bg-gray-400'}`}
                  title={effectivePriority !== task.priority ? 'Inherited from sub-task' : undefined}
                >
                  {priorityLabels[effectivePriority] || effectivePriority}
                </Badge>
              )
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  {task.priority && task.priority !== 'normal' ? (
                    <button
                      className={`text-xs px-1.5 py-0 h-5 gap-1 flex-shrink-0 text-white rounded-full inline-flex items-center cursor-pointer hover:opacity-80 ${priorityColors[task.priority] || 'bg-gray-400'}`}
                      data-testid={`priority-trigger-${task.id}`}
                    >
                      {priorityLabels[task.priority] || task.priority}
                    </button>
                  ) : (
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                      data-testid={`priority-trigger-${task.id}`}
                    >
                      +priority
                    </button>
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-32">
                  <DropdownMenuItem
                    onClick={() => onUpdate(task.id, { priority: 'high' })}
                    className="gap-2"
                    data-testid={`select-priority-high-${task.id}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${priorityColors['high']}`} />
                    High
                    {task.priority === 'high' && <Check className="h-3 w-3 ml-auto" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onUpdate(task.id, { priority: 'medium' })}
                    className="gap-2"
                    data-testid={`select-priority-medium-${task.id}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${priorityColors['medium']}`} />
                    Medium
                    {task.priority === 'medium' && <Check className="h-3 w-3 ml-auto" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onUpdate(task.id, { priority: 'normal' })}
                    className="gap-2"
                    data-testid={`select-priority-normal-${task.id}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-gray-400" />
                    Normal
                    {(!task.priority || task.priority === 'normal') && <Check className="h-3 w-3 ml-auto" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {project && !hideProjectBadge && (
              <Badge 
                variant="outline" 
                className={`text-xs px-1.5 py-0 h-5 gap-1 flex-shrink-0 ${isProjectInherited ? 'opacity-60' : ''}`}
                title={isProjectInherited ? 'Inherited from parent task' : undefined}
              >
                <FolderKanban className="h-2.5 w-2.5" />
                {project.name}
              </Badge>
            )}
            
            {!project && !parentTask?.projectId && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                    data-testid={`assign-project-${task.id}`}
                  >
                    +account
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48 max-h-64 overflow-y-auto">
                  {projects.map(p => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => onUpdate(task.id, { projectId: p.id })}
                      data-testid={`select-project-${p.id}`}
                    >
                      <FolderKanban className="h-3 w-3 mr-2" />
                      {p.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            <button
              ref={assigneeButtonRef}
              onClick={() => activePanel === 'assignee' ? closePanel() : openPanel('assignee', 'assignee')}
              className="text-xs text-muted-foreground truncate max-w-[200px] hover:text-foreground hover:underline cursor-pointer"
              title="Click to assign people"
              data-testid={`assignee-trigger-${task.id}`}
            >
              {displayAssignees.length > 0 
                ? [...displayAssignees].sort((a, b) => a.name.localeCompare(b.name)).map(p => p.name).join(', ') 
                : '+assign'}
            </button>
            
            <div className="flex-1" />
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  ref={menuButtonRef}
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 flex-shrink-0 text-muted-foreground hover:text-destructive"
                  data-testid={`delete-${task.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Task</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{task.title}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => onDelete(task.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid={`confirm-delete-${task.id}`}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
        
        {/* Line 3: Created timestamp */}
        {showDetails && (
          <div className="ml-9 mt-0.5">
            <span className="text-[10px] text-muted-foreground">
              Created by {people.find(p => p.email === task.createdBy)?.name || task.createdBy} on {format(new Date(task.createdAt), "do MMMM yyyy 'at' HH:mm:ss")} {getTimezoneAbbr(new Date(task.createdAt))}
            </span>
          </div>
        )}
        
        {/* Line 4: Updated timestamp */}
        {showDetails && (
          <div className="ml-9 mt-0.5">
            <span className="text-[10px] text-muted-foreground">
              Last updated {task.updatedBy ? `by ${people.find(p => p.email === task.updatedBy)?.name || task.updatedBy} ` : ''}on {format(new Date(task.updatedAt), "do MMMM yyyy 'at' HH:mm:ss")} {getTimezoneAbbr(new Date(task.updatedAt))}
            </span>
          </div>
        )}
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
              hiddenAssigneeIds={hiddenAssigneeIds}
              showDetailsToggle={showDetailsToggle}
              openTaskId={openTaskId}
              onOpenDetails={onOpenDetails}
            />
          ))}
        </div>
      )}

      {showSubtaskInput && (
        <InlineTaskInput
          onSubmit={handleSubtaskCreate}
          onCancel={() => setShowSubtaskInput(false)}
          placeholder={project ? `Add sub-task for ${project.name}... (@person #status $priority !date)` : "Add sub-task... (@@account @person #status $priority !date)"}
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
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const allTasksContainerRef = useRef<HTMLDivElement>(null);

  // Close task details when clicking outside the All Tasks section
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      // Don't close if clicking inside the container
      if (allTasksContainerRef.current?.contains(target)) return;
      // Don't close if clicking inside a Radix portal (dropdown, popover, etc.)
      if (target.closest?.('[data-radix-popper-content-wrapper]') ||
          target.closest?.('[role="menu"]') ||
          target.closest?.('[role="dialog"]') ||
          target.closest?.('[role="listbox"]')) {
        return;
      }
      setOpenTaskId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      priority: parsed.priorityTag || 'normal',
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
    
    if (parsed.dueDate) {
      taskData.dueDate = parsed.dueDate;
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

  if (tasksLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const priorityOrder: Record<string, number> = { high: 2, medium: 1, normal: 0 };
  const sortByPriority = (tasks: Task[]) => 
    [...tasks].sort((a, b) => (priorityOrder[b.priority || 'normal'] || 0) - (priorityOrder[a.priority || 'normal'] || 0));
  
  const myActiveTasks = sortByPriority(myRootTasks.filter(t => t.status === 'todo' || t.status === 'in-progress'));
  const myBlockedTasks = sortByPriority(myRootTasks.filter(t => t.status === 'blocked'));
  const myClosedTasks = sortByPriority(myRootTasks.filter(t => t.status === 'done'));

  return (
    <div className="space-y-6" data-testid="your-workspace-section">
      {/* Create Task Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Task
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Use @@account to link, @name to assign, #status, $priority, !date, // for notes
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <InlineTaskInput 
            onSubmit={(title, parsed) => handleCreateTask(title, parsed)} 
            placeholder="Type a task and press Enter..."
            autoFocus
            projects={projects}
            people={people}
          />
        </CardContent>
      </Card>

      {/* Your Tasks Section */}
      {myRootTasks.length > 0 && (
        <div ref={allTasksContainerRef}>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-medium">Your Tasks</span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1 text-xs">
                <Circle className="h-3 w-3 text-slate-400" />
                <Play className="h-3 w-3 text-green-500 fill-green-500" />
                Active: {myActiveTasks.length}
              </Badge>
              <Badge variant="secondary" className="gap-1 text-xs">
                <Ban className="h-3 w-3 text-red-500" />
                Blocked: {myBlockedTasks.length}
              </Badge>
              <Badge variant="secondary" className="gap-1 text-xs">
                <Check className="h-3 w-3 text-blue-500" />
                Closed: {myClosedTasks.length}
              </Badge>
            </div>
          </div>

          <div className="border rounded-lg bg-card space-y-8 p-4">
            {myActiveTasks.length > 0 && (
              <Collapsible defaultOpen={true}>
                <CollapsibleTrigger className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-muted/50 hover:bg-muted w-full text-left group">
                  <Plus className="h-4 w-4 group-data-[state=open]:hidden" />
                  <Minus className="h-4 w-4 hidden group-data-[state=open]:block" />
                  <Play className="h-4 w-4 text-green-500 fill-green-500" />
                  To-do / In-progress ({myActiveTasks.length})
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border rounded-md bg-background mt-1">
                    {myActiveTasks.map(task => (
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
                        showDetailsToggle={true}
                        openTaskId={openTaskId}
                        onOpenDetails={setOpenTaskId}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {myBlockedTasks.length > 0 && (
              <Collapsible defaultOpen={true}>
                <CollapsibleTrigger className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-muted/50 hover:bg-muted w-full text-left group">
                  <Plus className="h-4 w-4 group-data-[state=open]:hidden" />
                  <Minus className="h-4 w-4 hidden group-data-[state=open]:block" />
                  <Ban className="h-4 w-4 text-red-500" />
                  Blockers ({myBlockedTasks.length})
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border rounded-md mt-1">
                    {myBlockedTasks.map(task => (
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
                        showDetailsToggle={true}
                        openTaskId={openTaskId}
                        onOpenDetails={setOpenTaskId}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {myClosedTasks.length > 0 && (
              <Collapsible defaultOpen={false}>
                <CollapsibleTrigger className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-muted/50 hover:bg-muted w-full text-left group">
                  <Plus className="h-4 w-4 group-data-[state=open]:hidden" />
                  <Minus className="h-4 w-4 hidden group-data-[state=open]:block" />
                  <Check className="h-4 w-4 text-blue-500" />
                  Closed ({myClosedTasks.length})
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border rounded-md bg-muted/30 mt-1">
                    {myClosedTasks.map(task => (
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
                        showDetailsToggle={true}
                        openTaskId={openTaskId}
                        onOpenDetails={setOpenTaskId}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </div>
      )}

      {myRootTasks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Tasks Yet</h3>
            <p className="text-muted-foreground">
              Create your first task using the form above.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
