import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { migrateOrgWideResources } from './migrate-org-wide-resources.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Load cached org-wide mappings or run org-wide migration.
 */
export async function loadOrMigrateOrgWide(org, extractedData, scClient, sqClient, orgResult, results, ctx, journal) {
  const cachePath = join(ctx.outputDir, 'cache', `org-wide-mappings-${org.key}.json`);

  if (journal?.isOrgWideCompleted(org.key)) {
    orgResult.steps.push({ step: 'Org-wide resources', status: 'skipped', detail: 'Completed in previous run', durationMs: 0 });
    try {
      const cached = JSON.parse(await readFile(cachePath, 'utf-8'));
      return { gateMapping: new Map(cached.gateMapping || []), builtInProfileMapping: new Map(cached.builtInProfileMapping || []) };
    } catch (e) { logger.warn(`Could not load cached org-wide mappings: ${e.message}`); }
  }

  const result = await migrateOrgWideResources(extractedData, scClient, sqClient, orgResult, results, ctx);

  if (journal) {
    try {
      await mkdir(join(ctx.outputDir, 'cache'), { recursive: true });
      const data = { gateMapping: [...result.gateMapping.entries()], builtInProfileMapping: [...result.builtInProfileMapping.entries()] };
      await writeFile(cachePath, JSON.stringify(data));
    } catch (e) { logger.warn(`Failed to cache org-wide mappings: ${e.message}`); }
    await journal.markOrgWideCompleted(org.key);
  }

  return result;
}
