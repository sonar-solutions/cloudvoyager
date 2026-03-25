import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import logger from '../../../../shared/utils/logger.js';

// -------- Setup Output Directories --------

export async function setupOutputDirs(outputDir, isResume) {
  if (!isResume) {
    logger.info(`Cleaning output directory: ${outputDir}`);
    await rm(outputDir, { recursive: true, force: true });
  }

  await mkdir(outputDir, { recursive: true });
  await mkdir(join(outputDir, 'state'), { recursive: true });
  await mkdir(join(outputDir, 'quality-profiles'), { recursive: true });
  await mkdir(join(outputDir, 'logs'), { recursive: true });
}
