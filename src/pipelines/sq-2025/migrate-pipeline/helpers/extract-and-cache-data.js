import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { SonarQubeClient } from '../../sonarqube/api-client.js';
import { extractAllProjects, extractServerWideData } from '../../pipeline/extraction.js';
import { runFatalStep } from '../../pipeline/results.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Extract and Cache Server-Wide Data --------

/** Connect to SQ, extract server-wide data, and cache for reuse. */
export async function extractAndCacheData(ctx, results, perfConfig, cachedServerData) {
  logger.info('=== Step 1: Connecting to SonarQube ===');
  const sqClient = new SonarQubeClient({ url: ctx.sonarqubeConfig.url, token: ctx.sonarqubeConfig.token });
  await runFatalStep(results, 'Connect to SonarQube', () => sqClient.testConnection());

  logger.info('=== Step 2: Extracting server-wide data from SonarQube ===');

  if (cachedServerData) {
    logger.info('Using cached server-wide data (skipping re-extraction)');
    results.serverSteps.push({ step: 'Server-wide data', status: 'cached', detail: 'Loaded from previous run' });
    return { allProjects: cachedServerData.allProjects, extractedData: cachedServerData.extractedData };
  }

  const allProjects = await extractAllProjects(sqClient, results);
  const extractedData = await extractServerWideData(sqClient, allProjects, results, perfConfig);

  try {
    const cacheDir = join(ctx.outputDir, 'cache');
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
  } catch (e) { logger.warn(`Failed to write cache: ${e.message}`); }

  return { allProjects, extractedData };
}
