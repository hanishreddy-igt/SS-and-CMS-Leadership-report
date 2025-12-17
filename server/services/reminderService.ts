import { storage } from '../storage';
import { sendReminderEmail, type ReminderEmailData } from './emailService';
import type { Project, WeeklyReport, Person } from '@shared/schema';

export type ReminderSlot = 'monday_midnight' | 'monday_noon' | 'tuesday_midnight';

interface LeadWithPendingProjects {
  leadId: string;
  leadName: string;
  leadEmail: string;
  pendingProjects: string[];
}

function getCurrentWeekStart(): string {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const daysToMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - daysToMonday,
    0, 0, 0, 0
  ));
  return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, '0')}-${String(monday.getUTCDate()).padStart(2, '0')}`;
}

function getWeekEnd(weekStart: string): string {
  const start = new Date(weekStart + 'T00:00:00Z');
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  return `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, '0')}-${String(end.getUTCDate()).padStart(2, '0')}`;
}

function getReminderNumber(slot: ReminderSlot): number {
  switch (slot) {
    case 'monday_midnight': return 1;
    case 'monday_noon': return 2;
    case 'tuesday_midnight': return 3;
  }
}

async function findLeadsWithPendingReports(weekStart: string): Promise<LeadWithPendingProjects[]> {
  const projects = await storage.getProjects();
  const reports = await storage.getWeeklyReports();
  const leads = await storage.getProjectLeads();

  const submittedReportsMap = new Map<string, boolean>();
  reports
    .filter(r => r.weekStart === weekStart && r.status === 'submitted')
    .forEach(r => {
      submittedReportsMap.set(`${r.projectId}`, true);
    });

  const leadProjectsMap = new Map<string, { leadName: string; leadEmail: string; projects: string[] }>();

  for (const project of projects) {
    const hasSubmittedReport = submittedReportsMap.has(project.id);
    
    if (!hasSubmittedReport) {
      const allLeadIds = project.leadIds && project.leadIds.length > 0 
        ? project.leadIds 
        : [project.leadId];

      for (const leadId of allLeadIds) {
        const lead = leads.find(l => l.id === leadId);
        if (lead && lead.email) {
          if (!leadProjectsMap.has(leadId)) {
            leadProjectsMap.set(leadId, {
              leadName: lead.name,
              leadEmail: lead.email,
              projects: []
            });
          }
          leadProjectsMap.get(leadId)!.projects.push(project.name);
        }
      }
    }
  }

  return Array.from(leadProjectsMap.entries()).map(([leadId, data]) => ({
    leadId,
    leadName: data.leadName,
    leadEmail: data.leadEmail,
    pendingProjects: data.projects
  }));
}

export async function sendRemindersForSlot(slot: ReminderSlot): Promise<{
  sent: number;
  skipped: number;
  failed: number;
  details: Array<{ leadEmail: string; status: 'sent' | 'skipped' | 'failed'; reason?: string }>;
}> {
  const weekStart = getCurrentWeekStart();
  const weekEnd = getWeekEnd(weekStart);
  const reminderNumber = getReminderNumber(slot);

  console.log(`[Reminder] Starting ${slot} reminder run for week ${weekStart}`);

  const leadsWithPending = await findLeadsWithPendingReports(weekStart);
  console.log(`[Reminder] Found ${leadsWithPending.length} leads with pending reports`);

  const results = {
    sent: 0,
    skipped: 0,
    failed: 0,
    details: [] as Array<{ leadEmail: string; status: 'sent' | 'skipped' | 'failed'; reason?: string }>
  };

  for (const lead of leadsWithPending) {
    const alreadySent = await storage.hasReminderBeenSent(lead.leadId, weekStart, slot);
    
    if (alreadySent) {
      results.skipped++;
      results.details.push({ 
        leadEmail: lead.leadEmail, 
        status: 'skipped', 
        reason: 'Already sent for this slot' 
      });
      continue;
    }

    const emailData: ReminderEmailData = {
      leadName: lead.leadName,
      leadEmail: lead.leadEmail,
      pendingProjects: lead.pendingProjects,
      weekStart,
      weekEnd,
      reminderNumber
    };

    const result = await sendReminderEmail(emailData);

    await storage.createEmailReminder({
      leadId: lead.leadId,
      leadEmail: lead.leadEmail,
      weekStart,
      reminderSlot: slot,
      projectNames: lead.pendingProjects,
      success: result.success ? 'true' : 'false',
      errorMessage: result.error || null
    });

    if (result.success) {
      results.sent++;
      results.details.push({ leadEmail: lead.leadEmail, status: 'sent' });
    } else {
      results.failed++;
      results.details.push({ 
        leadEmail: lead.leadEmail, 
        status: 'failed', 
        reason: result.error 
      });
    }
  }

  console.log(`[Reminder] Completed: ${results.sent} sent, ${results.skipped} skipped, ${results.failed} failed`);
  return results;
}

export async function getRemindersStatus(weekStart?: string): Promise<{
  weekStart: string;
  pendingLeads: number;
  remindersSent: Array<{ slot: ReminderSlot; count: number }>;
}> {
  const week = weekStart || getCurrentWeekStart();
  const leadsWithPending = await findLeadsWithPendingReports(week);
  const reminders = await storage.getEmailReminders(week);

  const slotCounts = new Map<ReminderSlot, number>();
  reminders.filter(r => r.success === 'true').forEach(r => {
    const slot = r.reminderSlot as ReminderSlot;
    slotCounts.set(slot, (slotCounts.get(slot) || 0) + 1);
  });

  return {
    weekStart: week,
    pendingLeads: leadsWithPending.length,
    remindersSent: [
      { slot: 'monday_midnight', count: slotCounts.get('monday_midnight') || 0 },
      { slot: 'monday_noon', count: slotCounts.get('monday_noon') || 0 },
      { slot: 'tuesday_midnight', count: slotCounts.get('tuesday_midnight') || 0 },
    ]
  };
}
