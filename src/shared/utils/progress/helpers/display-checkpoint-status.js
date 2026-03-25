// -------- Display Checkpoint Journal Status --------
import { existsSync } from 'node:fs';
import logger from '../../logger.js';
import { StateStorage } from '../../../state/storage.js';
import { logPhaseProgress } from './log-phase-progress.js';
import { logBranchProgress } from './log-branch-progress.js';
import { logCeTasks } from './log-ce-tasks.js';
import { getEstimatedTimeRemaining } from './get-estimated-time-remaining.js';

export async function displayCheckpointStatus(journalPath) {
  if (!existsSync(journalPath)) {
    logger.info('No checkpoint journal found. No transfer in progress.');
    return;
  }
  const storage = new StateStorage(journalPath);
  const journal = await storage.load();
  if (!journal) { logger.info('Checkpoint journal is empty or corrupt.'); return; }

  logger.info('=== Transfer Checkpoint Status ===');
  logger.info(`Status: ${journal.status || 'unknown'}`);
  if (journal.sessionFingerprint) {
    const fp = journal.sessionFingerprint;
    logger.info(`Project: ${fp.projectKey || 'unknown'}`);
    logger.info(`SonarQube: ${fp.sonarQubeUrl || 'unknown'} (v${fp.sonarQubeVersion || '?'})`);
    logger.info(`Started: ${fp.startedAt || 'unknown'}`);
  }
  logPhaseProgress(journal);
  logBranchProgress(journal);
  logCeTasks(journal);

  const estimate = getEstimatedTimeRemaining(journal);
  if (estimate) { logger.info(''); logger.info(`Estimated time remaining: ${estimate}`); }
}
