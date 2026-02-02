import type { TaskTemplate, Task, InsertTask, SubTemplateItem } from '@shared/schema';
import type { IStorage } from './storage';

const parseTimezoneOffset = (tz: string | null | undefined): number => {
  if (!tz) return 0;
  const match = tz.match(/^([+-]?)(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  const hoursOffset = parseInt(match[2], 10);
  const minutesOffset = parseInt(match[3] || '0', 10);
  return sign * (hoursOffset * 60 + minutesOffset);
};

// Calculate the current triggerable window (for scheduler triggering)
// Returns today's window if we're on a valid day, regardless of whether start time has passed
export function calculateCurrentTriggerWindow(template: TaskTemplate): { start: Date; end: Date } | null {
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
  
  const nowUTC = new Date();
  const nowInTzMs = nowUTC.getTime() + tzOffsetMinutes * 60 * 1000;
  const nowInTz = new Date(nowInTzMs);
  
  const dayMap: Record<string, number> = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6
  };
  
  const createDateInTz = (y: number, m: number, d: number, h: number, min: number): Date => {
    const dateInTz = Date.UTC(y, m, d, h, min, 0, 0);
    return new Date(dateInTz - tzOffsetMinutes * 60 * 1000);
  };
  
  const getDayOfWeekInTz = (date: Date): number => {
    const inTz = new Date(date.getTime() + tzOffsetMinutes * 60 * 1000);
    return inTz.getUTCDay();
  };
  
  const currentDayOfWeek = getDayOfWeekInTz(nowUTC);
  
  // Helper to check if a day is within a range (handles week wraparound)
  const isDayInRange = (current: number, start: number, end: number): boolean => {
    if (start <= end) {
      return current >= start && current <= end;
    } else {
      // Wraps around (e.g., Friday to Monday)
      return current >= start || current <= end;
    }
  };
  
  // Check if today is a valid trigger day based on recurrence type
  if (template.recurrence === 'daily') {
    const selectedDays = daysOfWeek.length > 0 ? daysOfWeek : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const selectedDayNumbers = selectedDays.map(d => dayMap[d]);
    if (!selectedDayNumbers.includes(currentDayOfWeek)) {
      return null; // Today is not a valid day
    }
  } else if (template.recurrence === 'weekly') {
    const startDayOfWeek = dayMap[startDay];
    const endDayOfWeek = dayMap[endDay];
    // Allow triggering any day from start day through end day
    if (!isDayInRange(currentDayOfWeek, startDayOfWeek, endDayOfWeek)) {
      return null; // Today is not within the valid window
    }
  } else if (template.recurrence === 'biweekly') {
    const startDayOfWeek = dayMap[startDay];
    const endDayOfWeek = dayMap[endDay];
    // Allow triggering any day from start day through end day
    if (!isDayInRange(currentDayOfWeek, startDayOfWeek, endDayOfWeek)) {
      return null; // Today is not within the valid window
    }
    // Check if this is the right week (every other week)
    // Calculate which week we're in based on the START of this week's window
    const daysFromStart = (currentDayOfWeek - startDayOfWeek + 7) % 7;
    const windowStartDate = new Date(nowInTzMs - daysFromStart * 24 * 60 * 60 * 1000);
    const anchorDate = template.lastUsedAt ? new Date(template.lastUsedAt) : new Date(template.createdAt);
    const daysSinceAnchor = Math.floor((windowStartDate.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24));
    const weeksOffset = Math.floor(daysSinceAnchor / 7) % 2;
    if (weeksOffset !== 0) {
      return null; // Not the right biweekly period
    }
  } else if (template.recurrence === 'monthly') {
    const dayOfMonth = nowInTz.getUTCDate();
    const lastDayOfMonth = new Date(Date.UTC(nowInTz.getUTCFullYear(), nowInTz.getUTCMonth() + 1, 0)).getUTCDate();
    const actualStartDate = startDate === 0 ? lastDayOfMonth : Math.min(startDate, lastDayOfMonth);
    const actualEndDate = endDate === 0 ? lastDayOfMonth : Math.min(endDate, lastDayOfMonth);
    // Allow triggering any day from start date through end date
    if (actualStartDate <= actualEndDate) {
      if (dayOfMonth < actualStartDate || dayOfMonth > actualEndDate) {
        return null; // Not within the valid window
      }
    } else {
      // End date wraps to next month - only check start date in current month
      if (dayOfMonth < actualStartDate) {
        return null; // Not within the valid window
      }
    }
  } else if (template.recurrence === 'quarterly') {
    const currentMonth = nowInTz.getUTCMonth();
    const dayOfMonth = nowInTz.getUTCDate();
    // Determine current quarter (0=Q1, 1=Q2, 2=Q3, 3=Q4)
    const currentQuarter = Math.floor(currentMonth / 3);
    const quarterStartMonth = currentQuarter * 3; // 0, 3, 6, or 9
    const quarterEndMonth = quarterStartMonth + 2; // 2, 5, 8, or 11
    
    const lastDayOfMonth = new Date(Date.UTC(nowInTz.getUTCFullYear(), currentMonth + 1, 0)).getUTCDate();
    const actualStartDate = startDate === 0 ? new Date(Date.UTC(nowInTz.getUTCFullYear(), quarterStartMonth + 1, 0)).getUTCDate() : startDate;
    const actualEndDate = endDate === 0 ? lastDayOfMonth : endDate;
    
    // Check if we're within the quarter's valid window
    // Start date is in the first month of quarter, end date can extend into later months
    if (currentMonth === quarterStartMonth) {
      // In first month of quarter - must be on or after start date
      if (dayOfMonth < actualStartDate) {
        return null;
      }
    } else if (currentMonth > quarterStartMonth && currentMonth <= quarterEndMonth) {
      // In later months of quarter - check if we're before end date
      // If end date is in first month and we're past it, not valid
      if (endDate !== 0 && endDate < 28 && currentMonth > quarterStartMonth) {
        // End date was likely in first month, we've passed it
        return null;
      }
    } else {
      return null; // Not in this quarter
    }
  }
  
  // Return today's window with the original start time (even if in past)
  const startDateTimeUTC = createDateInTz(nowInTz.getUTCFullYear(), nowInTz.getUTCMonth(), nowInTz.getUTCDate(), startHours, startMinutes);
  const dueDateUTC = createDateInTz(nowInTz.getUTCFullYear(), nowInTz.getUTCMonth(), nowInTz.getUTCDate(), endHours, endMinutes);
  
  return { start: startDateTimeUTC, end: dueDateUTC };
}

export function calculateNextScheduledDelivery(template: TaskTemplate): { start: Date; end: Date } | null {
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
  
  const nowUTC = new Date();
  const nowInTzMs = nowUTC.getTime() + tzOffsetMinutes * 60 * 1000;
  const nowInTz = new Date(nowInTzMs);
  
  // Check if template was already triggered for the current period
  const lastTriggered = template.lastTriggeredAt ? new Date(template.lastTriggeredAt) : null;
  
  const dayMap: Record<string, number> = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6
  };
  
  let targetYear = nowInTz.getUTCFullYear();
  let targetMonth = nowInTz.getUTCMonth();
  let targetDay = nowInTz.getUTCDate();
  
  const createDateInTz = (y: number, m: number, d: number, h: number, min: number): Date => {
    const dateInTz = Date.UTC(y, m, d, h, min, 0, 0);
    return new Date(dateInTz - tzOffsetMinutes * 60 * 1000);
  };
  
  const getDayOfWeekInTz = (date: Date): number => {
    const inTz = new Date(date.getTime() + tzOffsetMinutes * 60 * 1000);
    return inTz.getUTCDay();
  };
  
  // Helper to check if lastTriggered is within a period starting at periodStart
  const wasTriggeredInPeriod = (periodStart: Date): boolean => {
    if (!lastTriggered) return false;
    return lastTriggered >= periodStart;
  };
  
  let startDateTimeUTC: Date;
  let dueDateUTC: Date;
  
  if (template.recurrence === 'daily') {
    const selectedDays = daysOfWeek.length > 0 ? daysOfWeek : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const selectedDayNumbers = selectedDays.map(d => dayMap[d]);
    
    let currentDay = getDayOfWeekInTz(nowUTC);
    let daysToAdd = 0;
    
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
    
    // Only advance to next day if:
    // 1. Today is a valid day AND
    // 2. The template was ALREADY TRIGGERED today (not just because time passed)
    const alreadyTriggeredToday = daysToAdd === 0 && wasTriggeredInPeriod(startDateTimeUTC);
    
    if (alreadyTriggeredToday) {
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
    
    // Helper to check if we're within the window (handles week wraparound)
    const isInWindow = (current: number, start: number, end: number): boolean => {
      if (start <= end) {
        return current >= start && current <= end;
      } else {
        return current >= start || current <= end;
      }
    };
    
    // Calculate days back to this week's start day
    let daysBackToStart = currentDayOfWeek - startDayOfWeek;
    if (daysBackToStart < 0) daysBackToStart += 7;
    
    // Calculate this week's start date
    const thisWeekStart = new Date(nowInTzMs);
    thisWeekStart.setUTCDate(thisWeekStart.getUTCDate() - daysBackToStart);
    
    startDateTimeUTC = createDateInTz(thisWeekStart.getUTCFullYear(), thisWeekStart.getUTCMonth(), thisWeekStart.getUTCDate(), startHours, startMinutes);
    
    // Check if already triggered this week
    const alreadyTriggeredThisWeek = wasTriggeredInPeriod(startDateTimeUTC);
    
    // If triggered this week, or not in window anymore, advance to next week
    const inWindow = isInWindow(currentDayOfWeek, startDayOfWeek, endDayOfWeek);
    
    if (alreadyTriggeredThisWeek || !inWindow) {
      // Move to next week's start
      thisWeekStart.setUTCDate(thisWeekStart.getUTCDate() + 7);
      startDateTimeUTC = createDateInTz(thisWeekStart.getUTCFullYear(), thisWeekStart.getUTCMonth(), thisWeekStart.getUTCDate(), startHours, startMinutes);
    }
    
    if (template.recurrence === 'biweekly') {
      const anchorDate = template.lastUsedAt ? new Date(template.lastUsedAt) : new Date(template.createdAt);
      const daysSinceAnchor = Math.floor((startDateTimeUTC.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24));
      const weeksOffset = Math.floor(daysSinceAnchor / 7) % 2;
      if (weeksOffset !== 0) {
        thisWeekStart.setUTCDate(thisWeekStart.getUTCDate() + 7);
        startDateTimeUTC = createDateInTz(thisWeekStart.getUTCFullYear(), thisWeekStart.getUTCMonth(), thisWeekStart.getUTCDate(), startHours, startMinutes);
      }
    }
    
    let daysUntilEnd = endDayOfWeek - startDayOfWeek;
    if (daysUntilEnd < 0) daysUntilEnd += 7;
    
    const endDateCalc = new Date(thisWeekStart.getTime());
    endDateCalc.setUTCDate(endDateCalc.getUTCDate() + daysUntilEnd);
    dueDateUTC = createDateInTz(endDateCalc.getUTCFullYear(), endDateCalc.getUTCMonth(), endDateCalc.getUTCDate(), endHours, endMinutes);
  } else if (template.recurrence === 'monthly') {
    const actualStartDate = startDate === 0 ? new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate() : startDate;
    const actualEndDate = endDate === 0 ? new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate() : endDate;
    
    startDateTimeUTC = createDateInTz(targetYear, targetMonth, actualStartDate, startHours, startMinutes);
    
    // Only advance to next month if template was ALREADY TRIGGERED this month
    const alreadyTriggeredThisMonth = wasTriggeredInPeriod(startDateTimeUTC);
    
    if (alreadyTriggeredThisMonth) {
      const nextMonth = targetMonth + 1;
      const nextYear = nextMonth > 11 ? targetYear + 1 : targetYear;
      const adjMonth = nextMonth > 11 ? 0 : nextMonth;
      const newStartDate = startDate === 0 ? new Date(Date.UTC(nextYear, adjMonth + 1, 0)).getUTCDate() : startDate;
      startDateTimeUTC = createDateInTz(nextYear, adjMonth, newStartDate, startHours, startMinutes);
      targetYear = nextYear;
      targetMonth = adjMonth;
    }
    
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
    
    // Only advance to next quarter if template was ALREADY TRIGGERED this quarter
    const alreadyTriggeredThisQuarter = wasTriggeredInPeriod(startDateTimeUTC);
    
    if (alreadyTriggeredThisQuarter) {
      const nextQuarterStart = (currentQuarterStart + 3) % 12;
      const yearOffset = nextQuarterStart < currentQuarterStart ? 1 : 0;
      const newStartDate = startDate === 0 ? new Date(Date.UTC(targetYear + yearOffset, nextQuarterStart + 1, 0)).getUTCDate() : startDate;
      startDateTimeUTC = createDateInTz(targetYear + yearOffset, nextQuarterStart, newStartDate, startHours, startMinutes);
      targetYear += yearOffset;
      targetMonth = nextQuarterStart;
    }
    
    const quarterMonth = Math.floor(targetMonth / 3) * 3;
    let dueYear = targetYear;
    let dueMonth = quarterMonth;
    const actualEndDate = endDate === 0 ? new Date(Date.UTC(dueYear, dueMonth + 1, 0)).getUTCDate() : endDate;
    if (actualEndDate < (startDate === 0 ? 31 : startDate)) {
      dueMonth++;
      if (dueMonth > quarterMonth + 2) dueMonth = quarterMonth + 2;
    }
    const finalEndDate = endDate === 0 ? new Date(Date.UTC(dueYear, dueMonth + 1, 0)).getUTCDate() : endDate;
    dueDateUTC = createDateInTz(dueYear, dueMonth, finalEndDate, endHours, endMinutes);
  } else {
    return null;
  }
  
  return { start: startDateTimeUTC, end: dueDateUTC };
}

// Format due date with time and timezone offset for task storage
function formatDueDateWithTimezone(dueDate: Date, template: TaskTemplate): string {
  const endTime = template.endTime || template.deliveryTime || '23:59';
  const timezone = template.timezone || '+0';
  
  // Get date parts from the due date
  const year = dueDate.getUTCFullYear();
  const month = String(dueDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dueDate.getUTCDate()).padStart(2, '0');
  
  // Parse the end time
  const [hours, minutes] = endTime.split(':').map(Number);
  const hourStr = String(hours).padStart(2, '0');
  const minStr = String(minutes).padStart(2, '0');
  
  // Normalize timezone format (ensure it has proper format like +5:30 or -6)
  let tzStr = timezone;
  if (!tzStr.startsWith('+') && !tzStr.startsWith('-')) {
    tzStr = '+' + tzStr;
  }
  
  // Format: YYYY-MM-DDTHH:MM±HH:MM
  return `${year}-${month}-${day}T${hourStr}:${minStr}${tzStr}`;
}

export async function createTasksFromTemplate(
  template: TaskTemplate,
  storage: IStorage,
  dueDate: Date
): Promise<{ tasksCreated: number; subTasksCreated: number }> {
  const assignees = template.assignedTo || [];
  const subTemplates = (template.subTemplates as SubTemplateItem[]) || [];
  const dueDateStr = formatDueDateWithTimezone(dueDate, template);
  
  let tasksCreated = 0;
  let subTasksCreated = 0;
  
  // Create subtasks from template sub-templates
  const createSubTasksFromTemplates = async (parentTaskId: string, parentAssignees: string[]) => {
    for (const sub of subTemplates) {
      const subAssignees = sub.assignedTo && sub.assignedTo.length > 0 ? sub.assignedTo : parentAssignees;
      
      const subTaskData: InsertTask = {
        title: sub.title,
        projectId: template.projectId || null,
        parentTaskId: parentTaskId,
        assignedTo: subAssignees,
        createdBy: 'scheduler@system',
        status: 'todo',
        priority: sub.priority || 'normal',
        dueDate: dueDateStr,
        sortOrder: '0',
        notes: [],
        tags: []
      };
      
      await storage.createTask(subTaskData);
      subTasksCreated++;
    }
  };
  
  // Create per-assignee subtasks (when multiple assignees)
  const createPerAssigneeSubtasks = async (parentTaskId: string, assigneeIds: string[]) => {
    for (const assigneeId of assigneeIds) {
      const subTaskData: InsertTask = {
        title: template.name,
        projectId: template.projectId || null,
        parentTaskId: parentTaskId,
        assignedTo: [assigneeId],
        createdBy: 'scheduler@system',
        status: 'todo',
        priority: 'normal',
        dueDate: dueDateStr,
        sortOrder: '0',
        notes: [],
        tags: []
      };
      
      await storage.createTask(subTaskData);
      subTasksCreated++;
    }
  };
  
  // Always create ONE parent task with ALL assignees
  const notes: { content: string; author: string; timestamp: string }[] = [];
  if (template.taskItems) {
    notes.push({
      content: template.taskItems,
      author: 'scheduler@system',
      timestamp: new Date().toISOString()
    });
  }
  
  const taskData: InsertTask = {
    title: template.name,
    projectId: template.projectId || null,
    assignedTo: assignees,
    createdBy: 'scheduler@system',
    status: 'todo',
    priority: 'normal',
    dueDate: dueDateStr,
    sortOrder: '0',
    notes: notes,
    tags: []
  };
  
  const createdTask = await storage.createTask(taskData);
  tasksCreated++;
  
  // If multiple assignees, create a subtask for each person
  if (assignees.length > 1) {
    await createPerAssigneeSubtasks(createdTask.id, assignees);
  }
  
  // Create any defined sub-templates as subtasks
  if (subTemplates.length > 0) {
    await createSubTasksFromTemplates(createdTask.id, assignees);
  }
  
  return { tasksCreated, subTasksCreated };
}
