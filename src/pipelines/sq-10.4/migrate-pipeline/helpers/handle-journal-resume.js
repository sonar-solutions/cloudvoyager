import { existsSync } from 'node:fs';
import { promptMigrationResume } from '../../../../shared/utils/prompt.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Check for existing migration journal and prompt user for resume/restart/abort.
 */
export async function handleJournalResume(migrationJournal, migrationJournalPath, dryRun, forceRestart, sonarqubeUrl) {
  if (dryRun || forceRestart || !existsSync(migrationJournalPath)) return false;

  const existingData = await migrationJournal.peek();
  if (!existingData || existingData.status === 'completed') return false;

  const choice = await promptMigrationResume(existingData, sonarqubeUrl);
  if (choice === 'abort') { logger.info('Migration aborted by user.'); process.exit(0); }
  if (choice === 'restart') {
    logger.info('User chose to start fresh — discarding previous migration state.');
    return false;
  }

  logger.info('=== RESUME MODE: Continuing from previous migration journal ===');
  return true;
}
