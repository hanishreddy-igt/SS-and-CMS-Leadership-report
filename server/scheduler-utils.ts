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
  
  // Check if today is a valid trigger day based on recurrence type
  if (template.recurrence === 'daily') {
    const selectedDays = daysOfWeek.length > 0 ? daysOfWeek : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const selectedDayNumbers = selectedDays.map(d => dayMap[d]);
    if (!selectedDayNumbers.includes(currentDayOfWeek)) {
      return null; // Today is not a valid day
    }
  } else if (template.recurrence === 'weekly') {
    const startDayOfWeek = dayMap[startDay];
    if (currentDayOfWeek !== startDayOfWeek) {
      return null; // Today is not the start day
    }
  } else if (template.recurrence === 'biweekly') {
    const startDayOfWeek = dayMap[startDay];
    if (currentDayOfWeek !== startDayOfWeek) {
      return null; // Today is not the start day
    }
    // Check if this is the right week (every other week)
    const anchorDate = template.lastUsedAt ? new Date(template.lastUsedAt) : new Date(template.createdAt);
    const daysSinceAnchor = Math.floor((nowUTC.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24));
    const weeksOffset = Math.floor(daysSinceAnchor / 7) % 2;
    if (weeksOffset !== 0) {
      return null; // Not the right biweekly period
    }
  } else if (template.recurrence === 'monthly') {
    const dayOfMonth = nowInTz.getUTCDate();
    const lastDayOfMonth = new Date(Date.UTC(nowInTz.getUTCFullYear(), nowInTz.getUTCMonth() + 1, 0)).getUTCDate();
    const actualStartDate = startDate === 0 ? lastDayOfMonth : startDate;
    if (dayOfMonth !== actualStartDate) {
      return null; // Not the right day of month
    }
  } else if (template.recurrence === 'quarterly') {
    const currentMonth = nowInTz.getUTCMonth();
    const quarterStartMonths = [0, 3, 6, 9]; // Jan, Apr, Jul, Oct
    if (!quarterStartMonths.includes(currentMonth)) {
      return null; // Not a quarter start month
    }
    const dayOfMonth = nowInTz.getUTCDate();
    const lastDayOfMonth = new Date(Date.UTC(nowInTz.getUTCFullYear(), currentMonth + 1, 0)).getUTCDate();
    const actualStartDate = startDate === 0 ? lastDayOfMonth : startDate;
    if (dayOfMonth !== actualStartDate) {
      return null; // Not the right day of month
    }
  }
  
  // Return today's window
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
    
    // For "next scheduled" display, only advance if the DUE time has passed (not just start time)
    // This way, we show today's occurrence until it's completely done
    if (daysToAdd === 0 && dueDateUTC <= nowUTC) {
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
    
    const startDateCalc = new Date(nowInTzMs);
    startDateCalc.setUTCDate(startDateCalc.getUTCDate() + daysUntilStart);
    
    startDateTimeUTC = createDateInTz(startDateCalc.getUTCFullYear(), startDateCalc.getUTCMonth(), startDateCalc.getUTCDate(), startHours, startMinutes);
    
    if (daysUntilStart === 0 && startDateTimeUTC <= nowUTC) {
      startDateCalc.setUTCDate(startDateCalc.getUTCDate() + 7);
      startDateTimeUTC = createDateInTz(startDateCalc.getUTCFullYear(), startDateCalc.getUTCMonth(), startDateCalc.getUTCDate(), startHours, startMinutes);
    }
    
    if (template.recurrence === 'biweekly') {
      const anchorDate = template.lastUsedAt ? new Date(template.lastUsedAt) : new Date(template.createdAt);
      const daysSinceAnchor = Math.floor((startDateTimeUTC.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24));
      const weeksOffset = Math.floor(daysSinceAnchor / 7) % 2;
      if (weeksOffset !== 0) {
        startDateCalc.setUTCDate(startDateCalc.getUTCDate() + 7);
        startDateTimeUTC = createDateInTz(startDateCalc.getUTCFullYear(), startDateCalc.getUTCMonth(), startDateCalc.getUTCDate(), startHours, startMinutes);
      }
    }
    
    let daysUntilEnd = endDayOfWeek - startDayOfWeek;
    if (daysUntilEnd < 0) daysUntilEnd += 7;
    
    const endDateCalc = new Date(startDateCalc.getTime());
    endDateCalc.setUTCDate(endDateCalc.getUTCDate() + daysUntilEnd);
    dueDateUTC = createDateInTz(endDateCalc.getUTCFullYear(), endDateCalc.getUTCMonth(), endDateCalc.getUTCDate(), endHours, endMinutes);
  } else if (template.recurrence === 'monthly') {
    const actualStartDate = startDate === 0 ? new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate() : startDate;
    const actualEndDate = endDate === 0 ? new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate() : endDate;
    
    startDateTimeUTC = createDateInTz(targetYear, targetMonth, actualStartDate, startHours, startMinutes);
    
    if (startDateTimeUTC <= nowUTC) {
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
    
    if (startDateTimeUTC <= nowUTC) {
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

export async function createTasksFromTemplate(
  template: TaskTemplate,
  storage: IStorage,
  dueDate: Date
): Promise<{ tasksCreated: number; subTasksCreated: number }> {
  const assignees = template.assignedTo || [];
  const mode = template.assignmentMode || 'single';
  const subTemplates = (template.subTemplates as SubTemplateItem[]) || [];
  const dueDateStr = dueDate.toISOString().split('T')[0];
  
  let tasksCreated = 0;
  let subTasksCreated = 0;
  
  const createSubTasks = async (parentTaskId: string, parentAssignees: string[]) => {
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
  
  if (mode === 'per-person' && assignees.length > 0) {
    for (const assigneeId of assignees) {
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
        assignedTo: [assigneeId],
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
      
      if (subTemplates.length > 0) {
        await createSubTasks(createdTask.id, [assigneeId]);
      }
    }
  } else {
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
    
    if (subTemplates.length > 0) {
      await createSubTasks(createdTask.id, assignees);
    }
  }
  
  return { tasksCreated, subTasksCreated };
}
