import logger from '../../../../../shared/utils/logger.js';
import { createStubChangeset } from './helpers/create-stub-changeset.js';
import { resolveLineCount } from './helpers/resolve-line-count.js';

// -------- Extract Changesets --------

/** Extract SCM changeset (blame) data — creates minimal stub data for each source file. */
export async function extractChangesets(client, sourceFiles, components) {
  logger.info('Extracting SCM changeset data...');
  const changesets = new Map();

  for (const file of sourceFiles) {
    if (!file?.key) {
      logger.warn('Skipping file without key in changesets extraction');
      continue;
    }
    try {
      const lineCount = resolveLineCount(file, components);
      changesets.set(file.key, createStubChangeset(lineCount));
    } catch (error) {
      logger.warn(`Failed to create changeset for ${file.key}: ${error.message}`);
    }
  }

  logger.info(`Created ${changesets.size} changeset entries`);
  return changesets;
}
