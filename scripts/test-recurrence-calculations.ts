/**
 * Test script to verify calculateNextOccurrenceAfterTrigger for all recurrence types
 * Run with: npx tsx scripts/test-recurrence-calculations.ts
 */

import { calculateNextOccurrence, calculateNextOccurrenceAfterTrigger } from '../server/scheduler-utils';
import type { TaskTemplate } from '@shared/schema';

// Helper to create a mock template
function createMockTemplate(overrides: Partial<TaskTemplate>): TaskTemplate {
  return {
    id: 'test-id',
    name: 'Test Template',
    recurrence: 'daily',
    startTime: '09:00',
    endTime: '17:00',
    timezone: '-8', // PST
    isActive: true,
    autoTriggerEnabled: true,
    createdAt: new Date(),
    ...overrides
  } as TaskTemplate;
}

// Get current date info for logging
const now = new Date();
console.log('='.repeat(60));
console.log('RECURRENCE CALCULATION TEST');
console.log('='.repeat(60));
console.log(`Current UTC time: ${now.toISOString()}`);
console.log(`Current PST time (approx): ${new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString().replace('Z', ' PST')}`);
console.log(`Current IST time (approx): ${new Date(now.getTime() + 5.5 * 60 * 60 * 1000).toISOString().replace('Z', ' IST')}`);
console.log('');

// Test Daily
console.log('-'.repeat(60));
console.log('DAILY RECURRENCE');
console.log('-'.repeat(60));
const dailyTemplate = createMockTemplate({
  recurrence: 'daily',
  startTime: '05:00',
  endTime: '20:00',
  timezone: '-8',
  daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
});
const dailyInitial = calculateNextOccurrence(dailyTemplate);
console.log('Initial calculation (from now):');
console.log(`  nextTriggerAt: ${dailyInitial?.nextTriggerAt}`);
console.log(`  nextDueAt: ${dailyInitial?.nextDueAt}`);

const dailyAfterTrigger = calculateNextOccurrenceAfterTrigger(dailyTemplate);
console.log('After trigger (should be tomorrow):');
console.log(`  nextTriggerAt: ${dailyAfterTrigger?.nextTriggerAt}`);
console.log(`  nextDueAt: ${dailyAfterTrigger?.nextDueAt}`);
console.log('');

// Test Weekly
console.log('-'.repeat(60));
console.log('WEEKLY RECURRENCE');
console.log('-'.repeat(60));
const weeklyTemplate = createMockTemplate({
  recurrence: 'weekly',
  startTime: '09:00',
  endTime: '17:00',
  startDay: 'monday',
  endDay: 'friday',
  timezone: '-7'
});
const weeklyInitial = calculateNextOccurrence(weeklyTemplate);
console.log('Initial calculation (from now):');
console.log(`  nextTriggerAt: ${weeklyInitial?.nextTriggerAt}`);
console.log(`  nextDueAt: ${weeklyInitial?.nextDueAt}`);

const weeklyAfterTrigger = calculateNextOccurrenceAfterTrigger(weeklyTemplate);
console.log('After trigger (should be next week):');
console.log(`  nextTriggerAt: ${weeklyAfterTrigger?.nextTriggerAt}`);
console.log(`  nextDueAt: ${weeklyAfterTrigger?.nextDueAt}`);
console.log('');

// Test Biweekly
console.log('-'.repeat(60));
console.log('BIWEEKLY RECURRENCE');
console.log('-'.repeat(60));
const biweeklyTemplate = createMockTemplate({
  recurrence: 'biweekly',
  startTime: '17:44',
  endTime: '20:00',
  startDay: 'wednesday',
  endDay: 'thursday',
  timezone: '+5:30'
});
const biweeklyInitial = calculateNextOccurrence(biweeklyTemplate);
console.log('Initial calculation (from now):');
console.log(`  nextTriggerAt: ${biweeklyInitial?.nextTriggerAt}`);
console.log(`  nextDueAt: ${biweeklyInitial?.nextDueAt}`);

const biweeklyAfterTrigger = calculateNextOccurrenceAfterTrigger(biweeklyTemplate);
console.log('After trigger (should be 2 weeks later):');
console.log(`  nextTriggerAt: ${biweeklyAfterTrigger?.nextTriggerAt}`);
console.log(`  nextDueAt: ${biweeklyAfterTrigger?.nextDueAt}`);
console.log('');

// Test Monthly
console.log('-'.repeat(60));
console.log('MONTHLY RECURRENCE');
console.log('-'.repeat(60));
const monthlyTemplate = createMockTemplate({
  recurrence: 'monthly',
  startTime: '09:00',
  endTime: '17:00',
  startDate: 1,
  endDate: 15,
  timezone: '+5:30'
});
const monthlyInitial = calculateNextOccurrence(monthlyTemplate);
console.log('Initial calculation (from now):');
console.log(`  nextTriggerAt: ${monthlyInitial?.nextTriggerAt}`);
console.log(`  nextDueAt: ${monthlyInitial?.nextDueAt}`);

const monthlyAfterTrigger = calculateNextOccurrenceAfterTrigger(monthlyTemplate);
console.log('After trigger (should be next month):');
console.log(`  nextTriggerAt: ${monthlyAfterTrigger?.nextTriggerAt}`);
console.log(`  nextDueAt: ${monthlyAfterTrigger?.nextDueAt}`);
console.log('');

// Test Quarterly
console.log('-'.repeat(60));
console.log('QUARTERLY RECURRENCE');
console.log('-'.repeat(60));
const quarterlyTemplate = createMockTemplate({
  recurrence: 'quarterly',
  startTime: '09:00',
  endTime: '17:00',
  startDate: 1,
  endDate: 15,
  timezone: '-8'
});
const quarterlyInitial = calculateNextOccurrence(quarterlyTemplate);
console.log('Initial calculation (from now):');
console.log(`  nextTriggerAt: ${quarterlyInitial?.nextTriggerAt}`);
console.log(`  nextDueAt: ${quarterlyInitial?.nextDueAt}`);

const quarterlyAfterTrigger = calculateNextOccurrenceAfterTrigger(quarterlyTemplate);
console.log('After trigger (should be next quarter):');
console.log(`  nextTriggerAt: ${quarterlyAfterTrigger?.nextTriggerAt}`);
console.log(`  nextDueAt: ${quarterlyAfterTrigger?.nextDueAt}`);
console.log('');

console.log('='.repeat(60));
console.log('TEST COMPLETE');
console.log('='.repeat(60));
