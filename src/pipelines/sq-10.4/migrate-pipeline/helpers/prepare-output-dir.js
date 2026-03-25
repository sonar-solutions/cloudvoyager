import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import logger from '../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Prepare the output directory (clean start or resume).
 */
export async function prepareOutputDir(outputDir, isResume) {
  const subdirs = ['state', 'quality-profiles', 'logs'];

  if (isResume) {
    await mkdir(outputDir, { recursive: true });
    for (const sub of subdirs) await mkdir(join(outputDir, sub), { recursive: true });
    return;
  }

  logger.info(`Cleaning output directory: ${outputDir}`);
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  for (const sub of subdirs) await mkdir(join(outputDir, sub), { recursive: true });
}
