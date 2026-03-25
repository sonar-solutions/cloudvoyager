// -------- Initialize Checkpoint Journal --------

import logger from '../../../utils/logger.js';
import { resetInterruptedPhases, resetInterruptedBranches } from './reset-interrupted.js';
import { createFreshJournal } from './create-fresh-journal.js';

export async function initializeJournal(self, storage, withLock, fingerprint, setJournal) {
  const existing = await storage.load();

  if (existing && existing.status !== 'completed') {
    setJournal(existing);
    logger.info(`Resuming from checkpoint journal (status: ${existing.status})`);
    self.validateFingerprint(fingerprint);
    resetInterruptedPhases(existing.phases || {});
    resetInterruptedBranches(existing.branches || {});
    existing.status = 'in_progress';
    await self.save();
    return true;
  }

  setJournal(createFreshJournal(fingerprint));
  await self.save();
  return false;
}
