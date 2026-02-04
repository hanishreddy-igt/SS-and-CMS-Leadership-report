import { db } from "../server/db";
import { taskTemplates } from "../shared/schema";
import { calculateNextOccurrence } from "../server/scheduler-utils";
import { eq } from "drizzle-orm";

async function migrateTemplateNextDates() {
  console.log("[Migration] Starting migration of template next dates...");

  const templates = await db.select().from(taskTemplates);
  console.log(`[Migration] Found ${templates.length} templates to process`);

  let updated = 0;
  let skipped = 0;

  for (const template of templates) {
    if (!template.recurrence || template.recurrence === "none") {
      console.log(`[Migration] Skipping "${template.name}" - no recurrence`);
      skipped++;
      continue;
    }

    const nextOccurrence = calculateNextOccurrence(template);
    
    if (nextOccurrence) {
      await db.update(taskTemplates)
        .set({
          nextTriggerAt: nextOccurrence.nextTriggerAt,
          nextDueAt: nextOccurrence.nextDueAt,
        })
        .where(eq(taskTemplates.id, template.id));

      console.log(`[Migration] Updated "${template.name}": nextTrigger=${nextOccurrence.nextTriggerAt}, nextDue=${nextOccurrence.nextDueAt}`);
      updated++;
    } else {
      console.log(`[Migration] Skipping "${template.name}" - could not calculate next occurrence`);
      skipped++;
    }
  }

  console.log(`[Migration] Complete: ${updated} updated, ${skipped} skipped`);
}

migrateTemplateNextDates()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[Migration] Error:", err);
    process.exit(1);
  });
