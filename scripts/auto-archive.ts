#!/usr/bin/env npx tsx

export {};
/**
 * Auto Archive Weekly Reports Script
 * 
 * This script calls the /api/scheduler/auto-archive endpoint to check if
 * weekly reports need to be archived and returns the status.
 * 
 * Note: The actual archiving (PDF generation, AI summary) is complex and
 * handled by the frontend. This script only checks if archiving is needed.
 * 
 * Usage:
 *   npx tsx scripts/auto-archive.ts
 *   npm run trigger:archive
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

async function checkAutoArchive() {
  console.log(`[${new Date().toISOString()}] Starting auto-archive check...`);
  console.log(`Target URL: ${APP_URL}/api/scheduler/auto-archive`);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (SCHEDULER_API_KEY) {
      headers['x-scheduler-key'] = SCHEDULER_API_KEY;
    }

    const response = await fetch(`${APP_URL}/api/scheduler/auto-archive`, {
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
      console.log(`\nStatus: ${result.message}`);
      
      if (result.needsArchive) {
        console.log(`\n⚠️  Archive Needed:`);
        console.log(`   Week: ${result.weekStart} to ${result.weekEnd}`);
        console.log(`   Reports: ${result.reportsCount}`);
        console.log(`\n   Note: Archiving requires PDF generation and AI summary.`);
        console.log(`   Please open the Reports section in the app to trigger archiving.`);
      } else {
        console.log(`\n✓ No action needed.`);
      }
    }

    console.log(`\n[${new Date().toISOString()}] Completed.`);
    process.exit(0);

  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] Failed:`, error.message);
    process.exit(1);
  }
}

checkAutoArchive();
