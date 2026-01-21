#!/usr/bin/env npx tsx

export {};
/**
 * Trigger Recurring Deliverables Script
 * 
 * This script calls the /api/scheduler/trigger-deliverables endpoint to create
 * tasks from recurring deliverable templates that are due.
 * 
 * Usage:
 *   npx tsx scripts/trigger-deliverables.ts
 *   npm run trigger:deliverables
 * 
 * Environment Variables:
 *   APP_URL - Base URL of the application (default: http://localhost:5000)
 *   SCHEDULER_API_KEY - Optional API key for authentication
 * 
 * This script is platform-agnostic and can be called from:
 *   - Replit Scheduled Deployments
 *   - Linux cron
 *   - Cloud schedulers (AWS CloudWatch, Google Cloud Scheduler, etc.)
 *   - GitHub Actions scheduled workflows
 *   - Any other automation system
 */

const APP_URL = process.env.APP_URL || 'http://localhost:5000';
const SCHEDULER_API_KEY = process.env.SCHEDULER_API_KEY;

async function triggerDeliverables() {
  console.log(`[${new Date().toISOString()}] Starting trigger-deliverables...`);
  console.log(`Target URL: ${APP_URL}/api/scheduler/trigger-deliverables`);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (SCHEDULER_API_KEY) {
      headers['x-scheduler-key'] = SCHEDULER_API_KEY;
    }

    const response = await fetch(`${APP_URL}/api/scheduler/trigger-deliverables`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error: HTTP ${response.status} - ${errorText}`);
      process.exit(1);
    }

    const result = await response.json();
    
    console.log('Result:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log(`\nSummary:`);
      console.log(`  Templates checked: ${result.templatesChecked}`);
      console.log(`  Templates triggered: ${result.templatesTriggered}`);
      
      if (result.results && result.results.length > 0) {
        console.log(`\nDetails:`);
        for (const r of result.results) {
          const status = r.status === 'triggered' 
            ? `✓ TRIGGERED (${r.tasksCreated} tasks)` 
            : r.status === 'not-due' 
              ? `○ Not due yet`
              : `✗ ${r.status}`;
          console.log(`  ${r.templateName}: ${status}`);
        }
      }
    }

    console.log(`\n[${new Date().toISOString()}] Completed successfully.`);
    process.exit(0);

  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] Failed:`, error.message);
    process.exit(1);
  }
}

triggerDeliverables();
