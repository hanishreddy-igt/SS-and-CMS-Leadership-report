import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export type ReminderEmailData = {
  leadName: string;
  leadEmail: string;
  pendingProjects: string[];
  weekStart: string;
  weekEnd: string;
  reminderNumber: number; // 1 = Monday midnight, 2 = Monday noon, 3 = Tuesday midnight
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00Z');
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  });
};

const getReminderSubject = (reminderNumber: number, projectCount: number): string => {
  const urgencyPrefix = reminderNumber === 3 ? 'URGENT: ' : reminderNumber === 2 ? 'Reminder: ' : '';
  return `${urgencyPrefix}Weekly Report${projectCount > 1 ? 's' : ''} Pending - ${projectCount} project${projectCount > 1 ? 's' : ''} awaiting submission`;
};

const getEmailHtml = (data: ReminderEmailData): string => {
  const { leadName, pendingProjects, weekStart, weekEnd, reminderNumber } = data;
  
  const urgencyMessage = reminderNumber === 3 
    ? '<p style="color: #dc2626; font-weight: bold;">This is your final reminder. Reports must be submitted before the end of Tuesday to be included in this week\'s archive.</p>'
    : reminderNumber === 2
    ? '<p style="color: #d97706; font-weight: bold;">This is your second reminder. Please submit your reports as soon as possible.</p>'
    : '';

  const projectList = pendingProjects
    .map(name => `<li style="margin: 8px 0;">${name}</li>`)
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%); padding: 24px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Weekly Report Reminder</h1>
  </div>
  
  <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
    <p>Hi ${leadName},</p>
    
    ${urgencyMessage}
    
    <p>You have <strong>${pendingProjects.length} project${pendingProjects.length > 1 ? 's' : ''}</strong> awaiting weekly report submission for the week of <strong>${formatDate(weekStart)} - ${formatDate(weekEnd)}</strong>:</p>
    
    <ul style="background: white; padding: 16px 16px 16px 32px; border-radius: 6px; border: 1px solid #e2e8f0;">
      ${projectList}
    </ul>
    
    <p>Please log in to the CMS & SS Leadership Report tool and submit your reports.</p>
    
    <div style="margin-top: 24px;">
      <a href="${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'https://your-app-url.replit.app'}" 
         style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
        Submit Reports
      </a>
    </div>
    
    <p style="margin-top: 32px; font-size: 14px; color: #64748b;">
      This is an automated reminder from the CMS & SS Leadership Report system.
    </p>
  </div>
</body>
</html>
  `;
};

export async function sendReminderEmail(data: ReminderEmailData): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.log('[Email] RESEND_API_KEY not configured, skipping email');
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const { data: result, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'CMS & SS Reports <onboarding@resend.dev>',
      to: [data.leadEmail],
      subject: getReminderSubject(data.reminderNumber, data.pendingProjects.length),
      html: getEmailHtml(data),
    });

    if (error) {
      console.error('[Email] Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log(`[Email] Reminder sent to ${data.leadEmail} for ${data.pendingProjects.length} projects`);
    return { success: true };
  } catch (err: any) {
    console.error('[Email] Failed to send:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

export async function testEmailConnection(): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.log('[Email] RESEND_API_KEY not configured');
    return false;
  }
  
  try {
    const domains = await resend.domains.list();
    console.log('[Email] Resend connection successful');
    return true;
  } catch (err) {
    console.error('[Email] Resend connection failed:', err);
    return false;
  }
}
