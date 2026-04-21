import { existsSync } from 'node:fs';
import { mkdir, readdir, rm } from 'node:fs/promises';
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
  if (existsSync(outputDir)) {
    const entries = await readdir(outputDir);
    for (const entry of entries) {
      if (entry === 'logs') continue;
      await rm(join(outputDir, entry), { recursive: true, force: true });
    }
  }
  await mkdir(outputDir, { recursive: true });
  for (const sub of subdirs) await mkdir(join(outputDir, sub), { recursive: true });
}
