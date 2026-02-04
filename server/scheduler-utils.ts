import type { TaskTemplate, Task, InsertTask, SubTemplateItem } from '@shared/schema';
import type { IStorage } from './storage';

const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Convert Date to day of week string in a specific timezone offset
export function getDayOfWeekString(date: Date, tzOffsetMinutes: number = 0): string {
  const dateInTz = new Date(date.getTime() + tzOffsetMinutes * 60 * 1000);
  return dayNames[dateInTz.getUTCDay()];
}

const parseTimezoneOffset = (tz: string | null | undefined): number => {
  if (!tz) return 0;
  const match = tz.match(/^([+-]?)(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  const hoursOffset = parseInt(match[2], 10);
  const minutesOffset = parseInt(match[3] || '0', 10);
  return sign * (hoursOffset * 60 + minutesOffset);
};

// Format timezone offset for ISO string (e.g., "+05:30" or "-08:00")
function formatTimezoneForISO(tz: string | null | undefined): string {
  if (!tz) return '+00:00';
  const match = tz.match(/^([+-]?)(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return '+00:00';
  const sign = match[1] === '-' ? '-' : '+';
  const hours = match[2].padStart(2, '0');
  const minutes = (match[3] || '0').padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

// Format a date as ISO string with embedded timezone (e.g., "2026-02-03T09:00+05:30")
function formatDateWithTimezone(year: number, month: number, day: number, hours: number, minutes: number, tz: string): string {
  const y = year.toString();
  const m = (month + 1).toString().padStart(2, '0');
  const d = day.toString().padStart(2, '0');
  const h = hours.toString().padStart(2, '0');
  const min = minutes.toString().padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}${tz}`;
}

/**
 * Calculate the next occurrence of a recurring template.
 * Returns ISO 8601 strings with embedded timezone.
 * 
 * @param template - The task template
 * @param fromDate - Calculate next occurrence from this date (default: now)
 * @returns { nextTriggerAt, nextDueAt } or null if invalid template
 */
export function calculateNextOccurrence(
  template: TaskTemplate, 
  fromDate: Date = new Date()
): { nextTriggerAt: string; nextDueAt: string } | null {
  const startTime = template.startTime || template.deliveryTime;
  const endTime = template.endTime || startTime;
  const startDay = template.startDay || template.deliveryDay || 'monday';
  const endDay = template.endDay || startDay;
  const startDate = template.startDate ?? template.deliveryDate ?? 1;
  const endDate = template.endDate ?? startDate;
  const daysOfWeek: string[] = template.daysOfWeek || [];
  
  if (!template.recurrence || !startTime) return null;
  
  const tzOffsetMinutes = parseTimezoneOffset(template.timezone);
  const tzFormatted = formatTimezoneForISO(template.timezone);
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = (endTime || startTime).split(':').map(Number);
  
  // Convert fromDate to template's timezone
  const fromInTzMs = fromDate.getTime() + tzOffsetMinutes * 60 * 1000;
  const fromInTz = new Date(fromInTzMs);
  
  const dayMap: Record<string, number> = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6
  };
  
  let triggerYear: number, triggerMonth: number, triggerDay: number;
  let dueYear: number, dueMonth: number, dueDay: number;
  
  if (template.recurrence === 'daily') {
    // Find next valid day from daysOfWeek
    const selectedDays = daysOfWeek.length > 0 ? daysOfWeek : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const selectedDayNumbers = selectedDays.map(d => dayMap[d]);
    
    const currentDayOfWeek = fromInTz.getUTCDay();
    const currentHours = fromInTz.getUTCHours();
    const currentMinutes = fromInTz.getUTCMinutes();
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;
    const endTimeInMinutes = endHours * 60 + endMinutes;
    
    // Check if today is past the END time (due time) - if past due time, move to next day
    const isPastEndTimeToday = currentTimeInMinutes > endTimeInMinutes;
    
    // Find next valid day (starting from today, or tomorrow if past end time)
    const startOffset = isPastEndTimeToday && selectedDayNumbers.includes(currentDayOfWeek) ? 1 : 0;
    let daysToAdd = 0;
    
    for (let i = startOffset; i < 7 + startOffset; i++) {
      const checkDay = (currentDayOfWeek + i) % 7;
      if (selectedDayNumbers.includes(checkDay)) {
        daysToAdd = i;
        break;
      }
    }
    
    const targetDate = new Date(fromInTzMs);
    targetDate.setUTCDate(targetDate.getUTCDate() + daysToAdd);
    
    triggerYear = targetDate.getUTCFullYear();
    triggerMonth = targetDate.getUTCMonth();
    triggerDay = targetDate.getUTCDate();
    dueYear = triggerYear;
    dueMonth = triggerMonth;
    dueDay = triggerDay;
    
  } else if (template.recurrence === 'weekly' || template.recurrence === 'biweekly') {
    const startDayNum = dayMap[startDay];
    const endDayNum = dayMap[endDay];
    const currentDayOfWeek = fromInTz.getUTCDay();
    const currentHours = fromInTz.getUTCHours();
    const currentMinutes = fromInTz.getUTCMinutes();
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;
    const endTimeInMinutes = endHours * 60 + endMinutes;
    
    // Check if we're past the END day and END time (due date/time)
    const isTodayEndDay = currentDayOfWeek === endDayNum;
    const isPastEndTimeToday = currentTimeInMinutes > endTimeInMinutes;
    
    // Calculate if we're past this week's due date
    // Days since start day in current week (could be negative if before start day)
    const daysSinceStartDay = (currentDayOfWeek - startDayNum + 7) % 7;
    const daysUntilEndDay = (endDayNum - startDayNum + 7) % 7;
    
    // Are we past the end day, or on end day but past end time?
    const isPastThisWeeksDueDate = 
      daysSinceStartDay > daysUntilEndDay || 
      (isTodayEndDay && isPastEndTimeToday);
    
    // Calculate days until next start day
    let daysUntilStart = (startDayNum - currentDayOfWeek + 7) % 7;
    if (daysUntilStart === 0 && !isPastThisWeeksDueDate) {
      // Today is start day and we haven't passed the due date yet - use today
      daysUntilStart = 0;
    } else if (isPastThisWeeksDueDate || daysUntilStart === 0) {
      // Past due date or today is start day but past due - go to next week
      daysUntilStart = (startDayNum - currentDayOfWeek + 7) % 7 || 7;
    }
    
    const triggerDate = new Date(fromInTzMs);
    triggerDate.setUTCDate(triggerDate.getUTCDate() + daysUntilStart);
    
    // For biweekly, check if this is the right week
    if (template.recurrence === 'biweekly') {
      // Normalize anchor to the startDay of anchor's week in template timezone
      const anchorDate = template.createdAt ? new Date(template.createdAt) : fromDate;
      const anchorInTzMs = anchorDate.getTime() + tzOffsetMinutes * 60 * 1000;
      const anchorInTz = new Date(anchorInTzMs);
      
      // Find the startDay of anchor's week (move back to most recent startDay)
      const anchorDayOfWeek = anchorInTz.getUTCDay();
      const daysToGoBack = (anchorDayOfWeek - startDayNum + 7) % 7;
      anchorInTz.setUTCDate(anchorInTz.getUTCDate() - daysToGoBack);
      anchorInTz.setUTCHours(0, 0, 0, 0); // Normalize to start of day
      
      const triggerInTz = new Date(triggerDate.getTime());
      triggerInTz.setUTCHours(0, 0, 0, 0); // Normalize to start of day
      
      const daysSinceAnchor = Math.floor((triggerInTz.getTime() - anchorInTz.getTime()) / (1000 * 60 * 60 * 24));
      const weeksOffset = Math.floor(daysSinceAnchor / 7) % 2;
      if (weeksOffset !== 0) {
        triggerDate.setUTCDate(triggerDate.getUTCDate() + 7);
      }
    }
    
    triggerYear = triggerDate.getUTCFullYear();
    triggerMonth = triggerDate.getUTCMonth();
    triggerDay = triggerDate.getUTCDate();
    
    // Calculate due date (end day of that week)
    let daysUntilEnd = (endDayNum - startDayNum + 7) % 7;
    if (daysUntilEnd === 0 && endDayNum !== startDayNum) daysUntilEnd = 7;
    
    const dueDate = new Date(triggerDate.getTime());
    dueDate.setUTCDate(dueDate.getUTCDate() + daysUntilEnd);
    
    dueYear = dueDate.getUTCFullYear();
    dueMonth = dueDate.getUTCMonth();
    dueDay = dueDate.getUTCDate();
    
  } else if (template.recurrence === 'monthly') {
    let targetMonth = fromInTz.getUTCMonth();
    let targetYear = fromInTz.getUTCFullYear();
    const currentDay = fromInTz.getUTCDate();
    const currentHours = fromInTz.getUTCHours();
    const currentMinutes = fromInTz.getUTCMinutes();
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;
    const endTimeInMinutes = endHours * 60 + endMinutes;
    
    // Get actual date (handle last day of month = 0)
    const getActualDate = (date: number, year: number, month: number): number => {
      if (date === 0) {
        return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      }
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      return Math.min(date, lastDay);
    };
    
    let actualStartDate = getActualDate(startDate, targetYear, targetMonth);
    let actualEndDate = getActualDate(endDate, targetYear, targetMonth);
    
    // Handle case where end date is in next month (endDate < startDate)
    let endMonthForCheck = targetMonth;
    let endYearForCheck = targetYear;
    if (actualEndDate < actualStartDate) {
      endMonthForCheck = (targetMonth + 1) % 12;
      endYearForCheck = targetMonth === 11 ? targetYear + 1 : targetYear;
      actualEndDate = getActualDate(endDate, endYearForCheck, endMonthForCheck);
    }
    
    // Check if we're past the END date and END time (due date/time)
    const isTodayEndDate = currentDay === actualEndDate && targetMonth === endMonthForCheck;
    const isPastEndTimeToday = currentTimeInMinutes > endTimeInMinutes;
    const isPastThisMonthsDueDate = 
      currentDay > actualEndDate || 
      (isTodayEndDate && isPastEndTimeToday);
    
    // If we've passed this month's due date, go to next month's cycle
    if (isPastThisMonthsDueDate) {
      targetMonth++;
      if (targetMonth > 11) {
        targetMonth = 0;
        targetYear++;
      }
      actualStartDate = getActualDate(startDate, targetYear, targetMonth);
    }
    
    triggerYear = targetYear;
    triggerMonth = targetMonth;
    triggerDay = actualStartDate;
    
    // Calculate due date
    let dueMonthCalc = targetMonth;
    let dueYearCalc = targetYear;
    const finalEndDate = getActualDate(endDate, dueYearCalc, dueMonthCalc);
    
    // If end date < start date, due is next month
    if (finalEndDate < actualStartDate) {
      dueMonthCalc++;
      if (dueMonthCalc > 11) {
        dueMonthCalc = 0;
        dueYearCalc++;
      }
    }
    
    dueYear = dueYearCalc;
    dueMonth = dueMonthCalc;
    dueDay = getActualDate(endDate, dueYearCalc, dueMonthCalc);
    
  } else if (template.recurrence === 'quarterly') {
    let targetMonth = fromInTz.getUTCMonth();
    let targetYear = fromInTz.getUTCFullYear();
    const currentDay = fromInTz.getUTCDate();
    const currentHours = fromInTz.getUTCHours();
    const currentMinutes = fromInTz.getUTCMinutes();
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;
    const endTimeInMinutes = endHours * 60 + endMinutes;
    
    // Get current quarter's first month (0, 3, 6, 9)
    const currentQuarterStart = Math.floor(targetMonth / 3) * 3;
    
    const getActualDate = (date: number, year: number, month: number): number => {
      if (date === 0) {
        return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      }
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      return Math.min(date, lastDay);
    };
    
    let actualStartDate = getActualDate(startDate, targetYear, currentQuarterStart);
    let actualEndDate = getActualDate(endDate, targetYear, currentQuarterStart);
    
    // Determine due month (could be in a later month within the quarter if endDate < startDate)
    let dueMonthForCheck = currentQuarterStart;
    if (actualEndDate < actualStartDate) {
      dueMonthForCheck = currentQuarterStart + 1;
      if (dueMonthForCheck > currentQuarterStart + 2) dueMonthForCheck = currentQuarterStart + 2;
      actualEndDate = getActualDate(endDate, targetYear, dueMonthForCheck);
    }
    
    // Check if we're past the END date and END time (due date/time)
    const isTodayEndDate = currentDay === actualEndDate && targetMonth === dueMonthForCheck;
    const isPastEndTimeToday = currentTimeInMinutes > endTimeInMinutes;
    const isPastThisQuartersDueDate = 
      targetMonth > dueMonthForCheck ||
      (targetMonth === dueMonthForCheck && currentDay > actualEndDate) || 
      (isTodayEndDate && isPastEndTimeToday);
    
    if (isPastThisQuartersDueDate) {
      // Move to next quarter
      const nextQuarterStart = (currentQuarterStart + 3) % 12;
      if (nextQuarterStart < currentQuarterStart) targetYear++;
      targetMonth = nextQuarterStart;
      actualStartDate = getActualDate(startDate, targetYear, targetMonth);
    } else {
      targetMonth = currentQuarterStart;
    }
    
    triggerYear = targetYear;
    triggerMonth = targetMonth;
    triggerDay = actualStartDate;
    
    // Calculate due date (in first month of quarter or later)
    actualEndDate = getActualDate(endDate, targetYear, targetMonth);
    
    dueYear = targetYear;
    dueMonth = targetMonth;
    dueDay = actualEndDate;
    
    // If end date < start date, due extends into next month (still in quarter)
    if (actualEndDate < actualStartDate) {
      dueMonth = targetMonth + 1;
      if (dueMonth > targetMonth + 2) dueMonth = targetMonth + 2; // Stay in quarter
      if (dueMonth > 11) {
        dueMonth = dueMonth % 12;
        dueYear++;
      }
      dueDay = getActualDate(endDate, dueYear, dueMonth);
    }
    
  } else {
    return null;
  }
  
  const nextTriggerAt = formatDateWithTimezone(triggerYear, triggerMonth, triggerDay, startHours, startMinutes, tzFormatted);
  const nextDueAt = formatDateWithTimezone(dueYear, dueMonth, dueDay, endHours, endMinutes, tzFormatted);
  
  return { nextTriggerAt, nextDueAt };
}

/**
 * Calculate the next occurrence AFTER a trigger has happened.
 * Used when updating template after triggering.
 * 
 * IMPORTANT: We need to calculate "tomorrow" in the TEMPLATE'S timezone,
 * not the server's timezone. Otherwise, when the server is in UTC and 
 * the template is in PST (-8), "tomorrow at midnight UTC" becomes 
 * "today at 4 PM PST" which is still before the end time.
 */
export function calculateNextOccurrenceAfterTrigger(template: TaskTemplate): { nextTriggerAt: string; nextDueAt: string } | null {
  // Get template's timezone offset
  const tzOffsetMinutes = parseTimezoneOffset(template.timezone);
  
  // Get current time in template's timezone
  const now = new Date();
  const nowInTzMs = now.getTime() + tzOffsetMinutes * 60 * 1000;
  const nowInTz = new Date(nowInTzMs);
  
  // Calculate tomorrow at midnight in template's timezone
  const tomorrowInTz = new Date(nowInTzMs);
  tomorrowInTz.setUTCDate(tomorrowInTz.getUTCDate() + 1);
  tomorrowInTz.setUTCHours(0, 0, 0, 0);
  
  // Convert back to UTC for the fromDate parameter
  // tomorrowInTz represents "tomorrow midnight" as if it were UTC
  // To get actual UTC time, we subtract the offset
  const tomorrowUtc = new Date(tomorrowInTz.getTime() - tzOffsetMinutes * 60 * 1000);
  
  return calculateNextOccurrence(template, tomorrowUtc);
}

// Format due date with time and timezone offset for task storage
// Uses template.nextDueAt string directly to avoid timezone conversion issues
function formatDueDateFromNextDueAt(template: TaskTemplate): string {
  // If we have nextDueAt, use it directly - it's already in the correct format
  if (template.nextDueAt) {
    return template.nextDueAt;
  }
  
  // Fallback: construct from template fields
  const endTime = template.endTime || template.deliveryTime || '23:59';
  const timezone = template.timezone || '+0';
  const tzFormatted = formatTimezoneForISO(timezone);
  
  // Use today's date as fallback
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  // Parse the end time
  const [hours, minutes] = endTime.split(':').map(Number);
  const hourStr = String(hours).padStart(2, '0');
  const minStr = String(minutes).padStart(2, '0');
  
  // Format: YYYY-MM-DDTHH:MM±HH:MM
  return `${year}-${month}-${day}T${hourStr}:${minStr}${tzFormatted}`;
}

export async function createTasksFromTemplate(
  template: TaskTemplate,
  storage: IStorage
): Promise<{ tasksCreated: number; subTasksCreated: number }> {
  const allAssignees = template.assignedTo || [];
  const subTemplates = (template.subTemplates as SubTemplateItem[]) || [];
  const dueDateStr = formatDueDateFromNextDueAt(template);
  const assigneeDays = (template as any).assigneeDays as Record<string, string[]> || {};
  
  // Parse the due date string to get day of week in template's timezone
  // The dueDateStr is already in the template's timezone (e.g., "2026-02-05T17:00-08:00")
  // Extract the date part directly from the string to avoid timezone conversion issues
  const datePart = dueDateStr.split('T')[0]; // "2026-02-05"
  const [year, month, day] = datePart.split('-').map(Number);
  const dueDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)); // Use noon UTC to avoid date boundary issues
  
  // Use template's timezone to determine day of week
  const tzOffsetMinutes = parseTimezoneOffset(template.timezone);
  const dayOfWeek = getDayOfWeekString(dueDate, tzOffsetMinutes);
  const templateDays = template.daysOfWeek || [];
  const isDaily = template.recurrence === 'daily';
  
  // Filter assignees: only include those whose day selection includes today
  const assignees = isDaily && allAssignees.length > 0
    ? allAssignees.filter(personId => {
        // If person has specific days, check if today is in their selection
        const personDays = assigneeDays[personId];
        if (personDays && personDays.length > 0) {
          return personDays.includes(dayOfWeek);
        }
        // If no specific days, use template's daysOfWeek (already validated by caller)
        return templateDays.length === 0 || templateDays.includes(dayOfWeek);
      })
    : allAssignees;
  
  // If no assignees are active for today, don't create any tasks
  if (isDaily && assignees.length === 0) {
    return { tasksCreated: 0, subTasksCreated: 0 };
  }
  
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
  
  // If template has multiple assignees, create per-assignee subtasks (even if only 1 is active today)
  if (allAssignees.length > 1 && assignees.length > 0) {
    await createPerAssigneeSubtasks(createdTask.id, assignees);
  }
  
  // Create any defined sub-templates as subtasks
  if (subTemplates.length > 0) {
    await createSubTasksFromTemplates(createdTask.id, assignees);
  }
  
  return { tasksCreated, subTasksCreated };
}
