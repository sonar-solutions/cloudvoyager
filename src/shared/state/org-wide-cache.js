import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import logger from '../utils/logger.js';

/**
 * Save org-wide mappings (gateMapping, builtInProfileMapping) to disk
 * so they can be restored on resume without re-running org-wide migrators.
 */
export async function saveOrgWideMappings(outputDir, orgKey, gateMapping, builtInProfileMapping) {
  try {
    const cacheDir = join(outputDir, 'cache');
    await mkdir(cacheDir, { recursive: true });
    const cachePath = join(cacheDir, `org-wide-mappings-${orgKey}.json`);
    await writeFile(cachePath, JSON.stringify({
      gateMapping: [...gateMapping.entries()],
      builtInProfileMapping: [...builtInProfileMapping.entries()]
    }));
  } catch (e) {
    logger.warn(`Failed to cache org-wide mappings: ${e.message}`);
  }
}

/**
 * Load cached org-wide mappings from a previous run.
 * Returns { gateMapping, builtInProfileMapping } or null if cache is missing/corrupt.
 */
export async function loadOrgWideMappings(outputDir, orgKey) {
  try {
    const cachePath = join(outputDir, 'cache', `org-wide-mappings-${orgKey}.json`);
    const cached = JSON.parse(await readFile(cachePath, 'utf-8'));
    const gateMapping = new Map(cached.gateMapping || []);
    const builtInProfileMapping = new Map(cached.builtInProfileMapping || []);
    logger.info(`Loaded cached org-wide mappings (${gateMapping.size} gates, ${builtInProfileMapping.size} profile overrides)`);
    return { gateMapping, builtInProfileMapping };
  } catch (e) {
    logger.warn(`Could not load cached org-wide mappings: ${e.message}. Org-wide migrators will re-derive mappings.`);
    return null;
  }
}
