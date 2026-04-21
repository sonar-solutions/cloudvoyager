import { existsSync } from 'node:fs';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { MigrationJournal } from '../../../../shared/state/migration-journal.js';
import { promptMigrationResume } from '../../../../shared/utils/prompt.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Handle Resume Prompt --------

/** Check for existing journal and prompt user for resume / restart / abort. */
export async function handleResumePrompt(outputDir, dryRun, forceRestart, sonarqubeUrl) {
  const journalPath = join(outputDir, 'state', 'migration.journal');
  const migrationJournal = new MigrationJournal(journalPath);
  let isResume = false;

  if (!dryRun && !forceRestart && existsSync(journalPath)) {
    const existingData = await migrationJournal.peek();
    if (existingData && existingData.status !== 'completed') {
      const choice = await promptMigrationResume(existingData, sonarqubeUrl);
      if (choice === 'abort') { logger.info('Migration aborted by user.'); process.exit(0); }
      else if (choice === 'restart') { logger.info('User chose to start fresh.'); }
      else { isResume = true; logger.info('=== RESUME MODE ==='); }
    }
  }

  return { migrationJournal, isResume };
}

/** Set up the output directory structure (clean or resume mode). */
export async function setupOutputDir(outputDir, isResume) {
  const dirs = [outputDir, join(outputDir, 'state'), join(outputDir, 'quality-profiles'), join(outputDir, 'logs')];
  if (!isResume) {
    logger.info(`Cleaning output directory: ${outputDir}`);
    if (existsSync(outputDir)) {
      const entries = await readdir(outputDir);
      for (const entry of entries) {
        if (entry === 'logs') continue;
        await rm(join(outputDir, entry), { recursive: true, force: true });
      }
    }
  }
  for (const dir of dirs) await mkdir(dir, { recursive: true });
}
