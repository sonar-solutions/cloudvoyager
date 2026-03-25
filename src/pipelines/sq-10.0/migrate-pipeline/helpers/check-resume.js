import { existsSync } from 'node:fs';
import logger from '../../../../shared/utils/logger.js';
import { MigrationJournal } from '../../../../shared/state/migration-journal.js';
import { promptMigrationResume } from '../../../../shared/utils/prompt.js';

// -------- Check for Resume Scenario --------

export async function checkResume(outputDir, dryRun, forceRestart, sonarqubeUrl) {
  const journalPath = `${outputDir}/state/migration.journal`;
  const journal = new MigrationJournal(journalPath);
  if (dryRun || forceRestart || !existsSync(journalPath)) return { journal, isResume: false };
  const existingData = await journal.peek();
  if (!existingData || existingData.status === 'completed') return { journal, isResume: false };
  const choice = await promptMigrationResume(existingData, sonarqubeUrl);
  if (choice === 'abort') { logger.info('Migration aborted by user.'); process.exit(0); }
  if (choice === 'restart') {
    logger.info('User chose to start fresh — discarding previous migration state.');
    return { journal, isResume: false };
  }
  logger.info('=== RESUME MODE: Continuing from previous migration journal ===');
  return { journal, isResume: true };
}
