import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus,
  Minus,
  MessageSquare,
  UserCheck,
  Circle,
  Play,
  Check,
  Ban,
  FileText,
  Calendar as CalendarIcon,
  Copy,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  TriangleAlert,
  StickyNote
} from 'lucide-react';
import type { Task, Project, Person } from '@shared/schema';
import { TaskRow, ParsedTitle, parseInlineTags } from './WorkingSpace';

// Helper to calculate UTC boundaries from local date
// Uses browser's local timezone - toISOString converts local date/time to UTC
function getUtcBoundaries(startDate: Date, endDate: Date): { startUtc: string; endUtc: string } {
  // Start of day in local timezone (midnight)
  const startLocal = new Date(startDate);
  startLocal.setHours(0, 0, 0, 0);
  
  // End of day in local timezone (23:59:59.999)
  const endLocal = new Date(endDate);
  endLocal.setHours(23, 59, 59, 999);
  
  // toISOString converts to UTC, which is what the backend expects
  return {
    startUtc: startLocal.toISOString(),
    endUtc: endLocal.toISOString()
  };
}

interface EODReport {
  startDate: string;
  endDate: string;
  user: string;
  summary: string;
  activityCount: number;
  accountsWorked: string[];
  rawActivities: string; // Formatted markdown string of activities grouped by account
}

export default function AssignedTasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isActiveExpanded, setIsActiveExpanded] = useState(true);
  const [isBlockedExpanded, setIsBlockedExpanded] = useState(true);
  const [isClosedExpanded, setIsClosedExpanded] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // EOD Report state
  const [isEodExpanded, setIsEodExpanded] = useState(true);
  const [eodDateMode, setEodDateMode] = useState<'single' | 'range'>('single');
  const [eodStartDate, setEodStartDate] = useState<Date>(new Date());
  const [eodEndDate, setEodEndDate] = useState<Date>(new Date());
  const [eodReport, setEodReport] = useState<EODReport | null>(null);
  const [isGeneratingEod, setIsGeneratingEod] = useState(false);
  const [startCalendarOpen, setStartCalendarOpen] = useState(false);
  const [endCalendarOpen, setEndCalendarOpen] = useState(false);

  // Close task details when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      // Don't close if clicking inside the container
      if (containerRef.current?.contains(target)) return;
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

  const createTaskMutation = useMutation({
    mutationFn: async (task: Partial<Task>) => {
      const res = await apiRequest('POST', '/api/tasks', task);
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
  
  const matchingPeople = people.filter(p => p.email === userEmail);
  const myPersonIds = matchingPeople.map(p => p.id);
  const assignedTasks = myPersonIds.length > 0
    ? allTasks.filter(t => t.assignedTo?.some(id => myPersonIds.includes(id)))
    : [];

  const priorityOrder: Record<string, number> = { high: 2, medium: 1, normal: 0 };
  const sortByPriority = (tasks: Task[]) => 
    [...tasks].sort((a, b) => (priorityOrder[b.priority || 'normal'] || 0) - (priorityOrder[a.priority || 'normal'] || 0));

  const activeTasks = sortByPriority(assignedTasks.filter(t => 
    (t.status === 'todo' || t.status === 'in-progress') && !t.parentTaskId
  ));
  const blockedTasks = sortByPriority(assignedTasks.filter(t => t.status === 'blocked' && !t.parentTaskId));
  const closedTasks = sortByPriority(assignedTasks.filter(t => t.status === 'done' && !t.parentTaskId));

  const handleUpdateTask = (id: string, updates: Partial<Task>) => {
    updateTaskMutation.mutate({ id, updates });
  };

  const handleDeleteTask = (id: string) => {
    deleteTaskMutation.mutate(id);
  };

  // EOD Report functions
  const generateEodReport = async () => {
    const effectiveEndDate = eodDateMode === 'single' ? eodStartDate : eodEndDate;
    
    // Validate date range
    if (eodDateMode === 'range' && eodEndDate < eodStartDate) {
      toast({ title: 'Invalid Date Range', description: 'End date must be after start date.', variant: 'destructive' });
      return;
    }
    
    setIsGeneratingEod(true);
    setEodReport(null);
    
    try {
      const { startUtc, endUtc } = getUtcBoundaries(eodStartDate, effectiveEndDate);
      
      const res = await apiRequest('GET', `/api/eod-report?startUtc=${encodeURIComponent(startUtc)}&endUtc=${encodeURIComponent(endUtc)}`);
      const data = await res.json();
      setEodReport(data);
      
      if (data.activityCount === 0) {
        toast({ title: 'No Activities', description: 'No task activities found for the selected date range.' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to generate report', variant: 'destructive' });
    } finally {
      setIsGeneratingEod(false);
    }
  };

  const copyEodToClipboard = async () => {
    if (!eodReport?.summary) return;
    
    try {
      await navigator.clipboard.writeText(eodReport.summary);
      toast({ title: 'Copied!', description: 'Report copied to clipboard' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to copy to clipboard', variant: 'destructive' });
    }
  };

  const setPresetDate = (preset: 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'last7Days') => {
    const now = new Date();
    
    switch (preset) {
      case 'today':
        setEodDateMode('single');
        setEodStartDate(now);
        setEodEndDate(now);
        break;
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        setEodDateMode('single');
        setEodStartDate(yesterday);
        setEodEndDate(yesterday);
        break;
      case 'thisWeek':
        const thisWeekStart = new Date(now);
        const dayOfWeek = thisWeekStart.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        thisWeekStart.setDate(thisWeekStart.getDate() + diffToMonday);
        setEodDateMode('range');
        setEodStartDate(thisWeekStart);
        setEodEndDate(now);
        break;
      case 'lastWeek':
        const lastWeekEnd = new Date(now);
        const lastWeekEndDayOfWeek = lastWeekEnd.getDay();
        const diffToLastSunday = lastWeekEndDayOfWeek === 0 ? -7 : -lastWeekEndDayOfWeek;
        lastWeekEnd.setDate(lastWeekEnd.getDate() + diffToLastSunday);
        const lastWeekStart = new Date(lastWeekEnd);
        lastWeekStart.setDate(lastWeekStart.getDate() - 6);
        setEodDateMode('range');
        setEodStartDate(lastWeekStart);
        setEodEndDate(lastWeekEnd);
        break;
      case 'last7Days':
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        setEodDateMode('range');
        setEodStartDate(sevenDaysAgo);
        setEodEndDate(now);
        break;
    }
  };

  const formatDateDisplay = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const handleCreateSubtask = (parentId: string, title: string, parsed: ParsedTitle) => {
    const parentTask = allTasks.find(t => t.id === parentId);
    
    let projectId = parentTask?.projectId || null;
    if (parsed.projectTag) {
      const matchedProject = projects.find(p => 
        p.name.toLowerCase().includes(parsed.projectTag!.toLowerCase())
      );
      if (matchedProject) projectId = matchedProject.id;
    }
    
    let assignedTo: string[] = [];
    if (parsed.personTags.length > 0) {
      assignedTo = parsed.personTags
        .map(tag => {
          const person = people.find(p => 
            p.name.toLowerCase().includes(tag.toLowerCase())
          );
          return person?.id;
        })
        .filter((id): id is string => id !== undefined);
    }
    
    const notes: { content: string; author: string; timestamp: string }[] = [];
    if (parsed.noteText) {
      notes.push({
        content: parsed.noteText,
        author: userEmail,
        timestamp: new Date().toISOString()
      });
    }
    
    createTaskMutation.mutate({
      title: parsed.text,
      status: (parsed.statusTag as Task['status']) || 'todo',
      priority: 'medium',
      projectId,
      assignedTo,
      notes,
      parentTaskId: parentId,
      createdBy: userEmail,
      isExpanded: 'true',
      tags: []
    });
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
          <h3 className="text-lg font-medium mb-2">No Tasks for You</h3>
          <p className="text-muted-foreground">
            You don't have any tasks assigned to you yet. Tasks assigned to your profile will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div ref={containerRef} className="space-y-4" data-testid="assigned-tasks-section">
      {/* EOD Report Section */}
      <Card className="border-primary/20">
        <Collapsible open={isEodExpanded} onOpenChange={setIsEodExpanded}>
          <CollapsibleTrigger className="w-full" data-testid="eod-report-trigger">
            <CardHeader className="flex flex-row items-center justify-between py-3 cursor-pointer hover-elevate">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">AI Activity Report</CardTitle>
              </div>
              {isEodExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              {/* Date Selection */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-muted rounded-md p-1">
                  <Button
                    variant={eodDateMode === 'single' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setEodDateMode('single')}
                    data-testid="eod-mode-single"
                  >
                    Single Day
                  </Button>
                  <Button
                    variant={eodDateMode === 'range' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setEodDateMode('range')}
                    data-testid="eod-mode-range"
                  >
                    Date Range
                  </Button>
                </div>

                {/* Date Pickers */}
                <div className="flex items-center gap-2">
                  <Popover open={startCalendarOpen} onOpenChange={setStartCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2" data-testid="eod-start-date">
                        <CalendarIcon className="h-4 w-4" />
                        {formatDateDisplay(eodStartDate)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={eodStartDate}
                        onSelect={(date) => {
                          if (date) {
                            setEodStartDate(date);
                            if (eodDateMode === 'single') setEodEndDate(date);
                            setStartCalendarOpen(false);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  {eodDateMode === 'range' && (
                    <>
                      <span className="text-muted-foreground">to</span>
                      <Popover open={endCalendarOpen} onOpenChange={setEndCalendarOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2" data-testid="eod-end-date">
                            <CalendarIcon className="h-4 w-4" />
                            {formatDateDisplay(eodEndDate)}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={eodEndDate}
                            onSelect={(date) => {
                              if (date) {
                                setEodEndDate(date);
                                setEndCalendarOpen(false);
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </>
                  )}
                </div>
              </div>

              {/* Preset Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setPresetDate('today')} data-testid="eod-preset-today">
                  Today
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPresetDate('yesterday')} data-testid="eod-preset-yesterday">
                  Yesterday
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPresetDate('thisWeek')} data-testid="eod-preset-thisweek">
                  This Week
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPresetDate('lastWeek')} data-testid="eod-preset-lastweek">
                  Last Week
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPresetDate('last7Days')} data-testid="eod-preset-last7days">
                  Last 7 Days
                </Button>
              </div>

              {/* Generate Button */}
              <Button
                onClick={generateEodReport}
                disabled={isGeneratingEod}
                className="w-full sm:w-auto"
                data-testid="eod-generate-btn"
              >
                {isGeneratingEod ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Report
                  </>
                )}
              </Button>

              {/* Report Preview */}
              {eodReport && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span>{eodReport.activityCount} activities across {eodReport.accountsWorked.length} account{eodReport.accountsWorked.length !== 1 ? 's' : ''}</span>
                    </div>
                    {eodReport.summary && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyEodToClipboard}
                        className="gap-2"
                        data-testid="eod-copy-btn"
                      >
                        <Copy className="h-4 w-4" />
                        Copy
                      </Button>
                    )}
                  </div>

                  {eodReport.summary ? (
                    <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap" data-testid="eod-report-content">
                      {eodReport.summary}
                    </div>
                  ) : (
                    <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground text-center">
                      No activities found for this date range.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <div className="flex items-center gap-4 flex-wrap">
        <Badge variant="secondary" className="gap-1">
          <Circle className="h-3 w-3 text-slate-400" />
          <Play className="h-3 w-3 text-green-500 fill-green-500" />
          Active: {activeTasks.length}
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <Ban className="h-3 w-3 text-red-500" />
          Blockers: {blockedTasks.length}
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <Check className="h-3 w-3 text-blue-500" />
          Closed: {closedTasks.length}
        </Badge>
      </div>

      <div className="flex items-center gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-700 dark:text-amber-400">
        <TriangleAlert className="h-5 w-5 flex-shrink-0" />
        <p className="text-sm leading-relaxed">Please add your end-of-shift reports or the work you did on the task as notes <StickyNote className="h-4 w-4 inline-block align-text-bottom mx-0.5" /> before closing a task. All due dates and times are displayed in your local date and time.</p>
      </div>

      <div className="border rounded-lg bg-card space-y-8 p-4">
        {activeTasks.length > 0 && (
          <Collapsible open={isActiveExpanded} onOpenChange={setIsActiveExpanded}>
            <CollapsibleTrigger className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-muted/50 hover:bg-muted w-full text-left group">
              <Plus className="h-4 w-4 group-data-[state=open]:hidden" />
              <Minus className="h-4 w-4 hidden group-data-[state=open]:block" />
              <Play className="h-4 w-4 text-green-500 fill-green-500" />
              To-do / In-progress ({activeTasks.length})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border rounded-md bg-background mt-1">
                {activeTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    allTasks={assignedTasks}
                    projects={projects}
                    people={people}
                    onUpdate={handleUpdateTask}
                    onDelete={handleDeleteTask}
                    onCreateSubtask={handleCreateSubtask}
                    userEmail={userEmail}
                    hiddenAssigneeIds={[]}
                    showDetailsToggle={true}
                    openTaskId={openTaskId}
                    onOpenDetails={setOpenTaskId}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {blockedTasks.length > 0 && (
          <Collapsible open={isBlockedExpanded} onOpenChange={setIsBlockedExpanded}>
            <CollapsibleTrigger className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-muted/50 hover:bg-muted w-full text-left group">
              <Plus className="h-4 w-4 group-data-[state=open]:hidden" />
              <Minus className="h-4 w-4 hidden group-data-[state=open]:block" />
              <Ban className="h-4 w-4 text-red-500" />
              Blockers ({blockedTasks.length})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border rounded-md mt-1">
                {blockedTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    allTasks={assignedTasks}
                    projects={projects}
                    people={people}
                    onUpdate={handleUpdateTask}
                    onDelete={handleDeleteTask}
                    onCreateSubtask={handleCreateSubtask}
                    userEmail={userEmail}
                    hiddenAssigneeIds={[]}
                    showDetailsToggle={true}
                    openTaskId={openTaskId}
                    onOpenDetails={setOpenTaskId}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {closedTasks.length > 0 && (
          <Collapsible open={isClosedExpanded} onOpenChange={setIsClosedExpanded}>
            <CollapsibleTrigger className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-muted/50 hover:bg-muted w-full text-left group">
              <Plus className="h-4 w-4 group-data-[state=open]:hidden" />
              <Minus className="h-4 w-4 hidden group-data-[state=open]:block" />
              <Check className="h-4 w-4 text-blue-500" />
              Closed ({closedTasks.length})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border rounded-md bg-muted/30 mt-1">
                {closedTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    allTasks={assignedTasks}
                    projects={projects}
                    people={people}
                    onUpdate={handleUpdateTask}
                    onDelete={handleDeleteTask}
                    onCreateSubtask={handleCreateSubtask}
                    userEmail={userEmail}
                    hiddenAssigneeIds={[]}
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
  );
}
