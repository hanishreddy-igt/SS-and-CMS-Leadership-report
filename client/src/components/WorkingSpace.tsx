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
  X
} from 'lucide-react';
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
  { value: 'cancelled', label: 'Cancelled' },
];

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
    const isLead = roles.includes('lead');
    const isMember = roles.includes('member');
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
      setValue('');
      setSuggestion({ type: null, startIndex: 0, query: '' });
    }
    if (e.key === 'Tab' && (!suggestion.type || suggestions.length === 0)) {
      e.preventDefault();
      if (e.shiftKey && onOutdent) {
        onOutdent();
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
          placeholder={placeholder}
          className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm h-8 px-1"
          data-testid="inline-task-input"
        />
        {suggestion.type && suggestions.length > 0 && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-popover border rounded-md shadow-lg p-1 min-w-[180px] max-h-48 overflow-auto" data-testid="suggestion-popover">
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

interface AssigneePickerProps {
  people: Person[];
  selected: string[];
  onSelect: (personIds: string[]) => void;
}

function AssigneePicker({ people, selected, onSelect }: AssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const selectedPeople = people.filter(p => selected.includes(p.id));

  const togglePerson = (personId: string) => {
    if (selected.includes(personId)) {
      onSelect(selected.filter(id => id !== personId));
    } else {
      onSelect([...selected, personId]);
    }
  };

  const getRoleLabel = (person: Person): string => {
    const roles = person.roles || [];
    const isLead = roles.includes('lead');
    const isMember = roles.includes('member');
    if (isLead && isMember) return '(Lead/Member)';
    if (isLead) return '(Lead)';
    if (isMember) return '(Member)';
    return '';
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-1.5 gap-1" data-testid="assignee-picker">
          {selectedPeople.length > 0 ? (
            <div className="flex -space-x-1">
              {selectedPeople.slice(0, 3).map(p => (
                <Avatar key={p.id} className="h-5 w-5 border border-background">
                  <AvatarFallback className="text-[10px] bg-primary/20">{getInitials(p.name)}</AvatarFallback>
                </Avatar>
              ))}
              {selectedPeople.length > 3 && (
                <span className="text-xs text-muted-foreground ml-1">+{selectedPeople.length - 3}</span>
              )}
            </div>
          ) : (
            <Users className="h-3 w-3 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="space-y-1 max-h-48 overflow-auto">
          {people.map(person => (
            <button
              key={person.id}
              onClick={() => togglePerson(person.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover-elevate ${
                selected.includes(person.id) ? 'bg-primary/10' : ''
              }`}
            >
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">{getInitials(person.name)}</AvatarFallback>
              </Avatar>
              <span className="flex-1 text-left truncate">{person.name}</span>
              <span className="text-xs text-muted-foreground">{getRoleLabel(person)}</span>
              {selected.includes(person.id) && <Checkbox checked className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface DueDatePickerProps {
  date?: string | null;
  onSelect: (date: string | null) => void;
}

function DueDatePicker({ date, onSelect }: DueDatePickerProps) {
  const [open, setOpen] = useState(false);
  const dateValue = date ? new Date(date) : undefined;
  const isOverdue = dateValue && isPast(dateValue) && !isToday(dateValue);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className={`h-6 px-1.5 gap-1 ${isOverdue ? 'text-destructive' : ''}`}
          data-testid="due-date-picker"
        >
          <CalendarIcon className="h-3 w-3" />
          {dateValue && (
            <span className="text-xs">{format(dateValue, 'MMM d')}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={(d) => {
            onSelect(d ? format(d, 'yyyy-MM-dd') : null);
            setOpen(false);
          }}
          initialFocus
        />
        {date && (
          <div className="p-2 border-t">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-destructive"
              onClick={() => { onSelect(null); setOpen(false); }}
            >
              Clear date
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface NotesPopoverProps {
  notes: TaskNote[];
  onAddNote: (content: string) => void;
  userEmail: string;
}

function NotesPopover({ notes, onAddNote, userEmail }: NotesPopoverProps) {
  const [open, setOpen] = useState(false);
  const [newNote, setNewNote] = useState('');

  const handleAdd = () => {
    if (newNote.trim()) {
      onAddNote(newNote.trim());
      setNewNote('');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-1.5 gap-1" data-testid="notes-button">
          <StickyNote className="h-3 w-3" />
          {notes.length > 0 && <span className="text-xs">{notes.length}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3">
          <div className="text-sm font-medium">Notes</div>
          
          {notes.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-auto">
              {notes.map((note, i) => (
                <div key={i} className="text-xs p-2 bg-muted rounded">
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
              placeholder="Add a note... (or use // in task)"
              className="min-h-[60px] text-sm"
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
      </PopoverContent>
    </Popover>
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
  userEmail
}: TaskRowProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [suggestion, setSuggestion] = useState<SuggestionState>({ type: null, startIndex: 0, query: '' });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

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
        const isLead = roles.includes('lead');
        const isMember = roles.includes('member');
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

  const handleToggleComplete = () => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    onUpdate(task.id, { status: newStatus });
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
    <div data-testid={`task-row-${task.id}`}>
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
          <Checkbox
            checked={task.status === 'done'}
            onCheckedChange={handleToggleComplete}
            className="h-4 w-4"
            data-testid={`checkbox-${task.id}`}
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
                    if (!suggestion.type) {
                      if (editValue.trim() && editValue !== task.title) {
                        const parsed = parseInlineTags(editValue.trim());
                        onUpdate(task.id, { title: parsed.text || editValue.trim() });
                      }
                      setIsEditing(false);
                    }
                  }, 150);
                }}
                className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm h-7 px-1"
                data-testid={`edit-input-${task.id}`}
              />
              {suggestion.type && editSuggestions.length > 0 && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-popover border rounded-md shadow-lg p-1 min-w-[180px] max-h-48 overflow-auto" data-testid="edit-suggestion-popover">
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
          
          {project && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 gap-1">
              <FolderKanban className="h-2.5 w-2.5" />
              {project.name}
            </Badge>
          )}
          
          {assignees.length > 0 && (
            <div className="flex -space-x-1">
              {assignees.slice(0, 2).map(p => (
                <Avatar key={p.id} className="h-5 w-5 border border-background">
                  <AvatarFallback className="text-[10px] bg-primary/20">{getInitials(p.name)}</AvatarFallback>
                </Avatar>
              ))}
              {assignees.length > 2 && (
                <span className="text-xs text-muted-foreground ml-1">+{assignees.length - 2}</span>
              )}
            </div>
          )}
          
          {task.dueDate && (
            <Badge variant={isOverdue ? "destructive" : "secondary"} className="text-xs px-1.5 py-0 h-5">
              {format(new Date(task.dueDate), 'MMM d')}
            </Badge>
          )}
          
          {notes.length > 0 && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 gap-1">
              <StickyNote className="h-2.5 w-2.5" />
              {notes.length}
            </Badge>
          )}
          
          <div className={`w-2 h-2 rounded-full ${statusColors[task.status] || statusColors.todo}`} title={statusLabels[task.status]} />
        </div>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <AssigneePicker
            people={people}
            selected={task.assignedTo || []}
            onSelect={(ids) => onUpdate(task.id, { assignedTo: ids })}
          />
          <DueDatePicker
            date={task.dueDate}
            onSelect={(date) => onUpdate(task.id, { dueDate: date })}
          />
          <NotesPopover
            notes={notes}
            onAddNote={handleAddNote}
            userEmail={userEmail}
          />
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
              onIndent={onIndent}
              onOutdent={onOutdent}
              depth={depth + 1}
              userEmail={userEmail}
            />
          ))}
        </div>
      )}

      {showSubtaskInput && (
        <InlineTaskInput
          onSubmit={handleSubtaskCreate}
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
          <p className="text-xs text-muted-foreground mt-1">
            Use @@project to link, @name to assign, #status to set status, // for notes
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
                            onCreateSubtask={(parentId, title, parsed) => handleCreateTask(title, parsed, parentId)}
                            onIndent={handleIndent}
                            onOutdent={handleOutdent}
                            userEmail={userEmail}
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
                          onCreateSubtask={(parentId, title, parsed) => handleCreateTask(title, parsed, parentId)}
                          onIndent={handleIndent}
                          onOutdent={handleOutdent}
                          userEmail={userEmail}
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
