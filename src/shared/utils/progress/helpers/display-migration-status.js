// -------- Display Migration Journal Status --------
import { existsSync } from 'node:fs';
import logger from '../../logger.js';
import { StateStorage } from '../../../state/storage.js';
import { statusIcon } from './status-icon.js';

export async function displayMigrationStatus(migrationJournalPath) {
  if (!existsSync(migrationJournalPath)) { logger.info('No migration journal found.'); return; }
  const storage = new StateStorage(migrationJournalPath);
  const journal = await storage.load();
  if (!journal) { logger.info('Migration journal is empty or corrupt.'); return; }

  logger.info('=== Migration Journal Status ===');
  logger.info(`Status: ${journal.status || 'unknown'}`);
  logger.info(`Started: ${journal.startedAt || 'unknown'}`);
  if (journal.completedAt) logger.info(`Completed: ${journal.completedAt}`);
  if (!journal.organizations) return;

  const orgs = Object.entries(journal.organizations);
  logger.info('');
  logger.info(`Organizations: ${orgs.length}`);

  for (const [orgKey, org] of orgs) {
    const projects = Object.entries(org.projects || {});
    const completed = projects.filter(([, p]) => p.status === 'completed').length;
    const failed = projects.filter(([, p]) => p.status === 'failed').length;

    logger.info('');
    logger.info(`  ${statusIcon(org.status)} ${orgKey} (org-wide: ${org.orgWideResources || 'pending'})`);
    logger.info(`       Projects: ${completed}/${projects.length} completed` + (failed > 0 ? `, ${failed} failed` : ''));

    for (const [projKey, proj] of projects) {
      const detail = proj.lastCompletedStep ? ` (last step: ${proj.lastCompletedStep})` : '';
      const error = proj.error ? ` — ${proj.error}` : '';
      logger.info(`         ${statusIcon(proj.status)} ${projKey}${detail}${error}`);
    }
  }
}
