// -------- Clear Journal Files --------

import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import logger from '../../../shared/utils/logger.js';

export async function clearJournalFiles(stateFile) {
  const journalPath = `${stateFile}.journal`;
  for (const suffix of ['', '.backup', '.tmp']) {
    const f = `${journalPath}${suffix}`;
    if (existsSync(f)) {
      await rm(f, { force: true });
      logger.info(`Removed checkpoint journal: ${f}`);
    }
  }
}
