import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import logger from '../../../../shared/utils/logger.js';

// -------- Prepare Output Directory --------

export async function prepareOutputDir(outputDir, isResume) {
  const dirs = [outputDir, join(outputDir, 'state'), join(outputDir, 'quality-profiles'), join(outputDir, 'logs')];
  if (!isResume) {
    logger.info(`Cleaning output directory: ${outputDir}`);
    await rm(outputDir, { recursive: true, force: true });
  }
  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }
}
