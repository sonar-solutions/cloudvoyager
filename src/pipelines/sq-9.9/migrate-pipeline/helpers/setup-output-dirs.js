import { existsSync } from 'node:fs';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import logger from '../../../../shared/utils/logger.js';

// -------- Setup Output Directories --------

export async function setupOutputDirs(outputDir, isResume) {
  if (!isResume) {
    logger.info(`Cleaning output directory: ${outputDir}`);
    if (existsSync(outputDir)) {
      const entries = await readdir(outputDir);
      for (const entry of entries) {
        if (entry === 'logs') continue;
        await rm(join(outputDir, entry), { recursive: true, force: true });
      }
    }
  }

  await mkdir(outputDir, { recursive: true });
  await mkdir(join(outputDir, 'state'), { recursive: true });
  await mkdir(join(outputDir, 'quality-profiles'), { recursive: true });
  await mkdir(join(outputDir, 'logs'), { recursive: true });
}
