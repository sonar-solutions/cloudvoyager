// -------- Initialize Journal --------

import logger from '../../../utils/logger.js';
import { logInterruptedProjects } from './log-interrupted.js';

const MIGRATION_JOURNAL_VERSION = 1;

export async function doInitialize(storage, withLock, meta, self, setJournal) {
  const existing = await storage.load();
  if (existing && existing.status !== 'completed') {
    setJournal(existing);
    logger.info(`Resuming migration from journal (status: ${existing.status})`);
    logInterruptedProjects(existing.organizations || {});
    existing.status = 'in_progress';
    await self.save();
    return true;
  }
  setJournal({
    version: MIGRATION_JOURNAL_VERSION,
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    sonarqubeUrl: meta.sonarqubeUrl || null,
    organizations: {},
  });
  await self.save();
  return false;
}
