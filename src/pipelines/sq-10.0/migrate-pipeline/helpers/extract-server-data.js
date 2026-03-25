import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import logger from '../../../../shared/utils/logger.js';
import { extractAllProjects, extractServerWideData } from '../../pipeline/extraction.js';

// -------- Extract or Load Server-Wide Data --------

export async function extractOrLoadServerData(sqClient, cachedServerData, results, perfConfig, outputDir) {
  if (cachedServerData) {
    logger.info('Using cached server-wide data (skipping re-extraction)');
    results.serverSteps.push({ step: 'Server-wide data', status: 'cached', detail: 'Loaded from previous run' });
    return { allProjects: cachedServerData.allProjects, extractedData: cachedServerData.extractedData };
  }
  const allProjects = await extractAllProjects(sqClient, results);
  const extractedData = await extractServerWideData(sqClient, allProjects, results, perfConfig);
  await cacheServerData(outputDir, allProjects, extractedData);
  return { allProjects, extractedData };
}

async function cacheServerData(outputDir, allProjects, extractedData) {
  try {
    const cacheDir = join(outputDir, 'cache');
    await mkdir(cacheDir, { recursive: true });
    const serializable = {
      allProjects,
      extractedData: {
        ...extractedData,
        projectBindings: [...extractedData.projectBindings.entries()],
        projectBranches: [...(extractedData.projectBranches || new Map()).entries()],
      },
    };
    await writeFile(join(cacheDir, 'server-wide-data.json'), JSON.stringify(serializable));
    logger.info('Server-wide data cached for subsequent runs');
  } catch (e) {
    logger.warn(`Failed to write server-wide data cache: ${e.message}`);
  }
}
