import { existsSync } from 'node:fs';
import { join } from 'node:path';
import logger from '../../../../shared/utils/logger.js';
import { MigrationJournal } from '../../../../shared/state/migration-journal.js';
import { promptMigrationResume } from '../../../../shared/utils/prompt.js';

// -------- Handle Migration Journal and Resume Logic --------

export async function handleJournalResume(outputDir, dryRun, forceRestart, sonarqubeUrl) {
  const journalPath = join(outputDir, 'state', 'migration.journal');
  const journal = new MigrationJournal(journalPath);
  let isResume = false;

  if (!dryRun && !forceRestart && existsSync(journalPath)) {
    const existingData = await journal.peek();
    if (existingData && existingData.status !== 'completed') {
      const choice = await promptMigrationResume(existingData, sonarqubeUrl);
      if (choice === 'abort') { logger.info('Migration aborted by user.'); process.exit(0); }
      if (choice === 'restart') { logger.info('User chose to start fresh — discarding previous migration state.'); }
      else { isResume = true; logger.info('=== RESUME MODE: Continuing from previous migration journal ==='); }
    }
  }

  return { journal, isResume };
}
