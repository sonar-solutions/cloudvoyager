import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { migrateOrgWideResources } from './migrate-org-wide-resources.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Load Cached Mappings --------

/** Load org-wide mappings from cache or run migration if not cached. */
export async function loadCachedMappings(org, migrationJournal, ctx, orgResult, results, extractedData, scClient, sqClient) {
  const orgWideCachePath = join(ctx.outputDir, 'cache', `org-wide-mappings-${org.key}.json`);

  if (migrationJournal?.isOrgWideCompleted(org.key)) {
    logger.info(`Org-wide resources for ${org.key} already completed — skipping`);
    orgResult.steps.push({ step: 'Org-wide resources', status: 'skipped', detail: 'Completed in previous run', durationMs: 0 });

    try {
      const cached = JSON.parse(await readFile(orgWideCachePath, 'utf-8'));
      const gateMapping = new Map(cached.gateMapping || []);
      const builtInProfileMapping = new Map(cached.builtInProfileMapping || []);
      logger.info(`Loaded cached org-wide mappings (${gateMapping.size} gates, ${builtInProfileMapping.size} profile overrides)`);
      return { gateMapping, builtInProfileMapping };
    } catch (e) {
      logger.warn(`Could not load cached org-wide mappings: ${e.message}. Re-deriving.`);
      return migrateOrgWideResources(extractedData, scClient, sqClient, orgResult, results, ctx);
    }
  }

  const result = await migrateOrgWideResources(extractedData, scClient, sqClient, orgResult, results, ctx);

  if (migrationJournal) {
    try {
      await mkdir(join(ctx.outputDir, 'cache'), { recursive: true });
      await writeFile(orgWideCachePath, JSON.stringify({
        gateMapping: [...result.gateMapping.entries()],
        builtInProfileMapping: [...result.builtInProfileMapping.entries()],
      }));
    } catch (e) { logger.warn(`Failed to cache org-wide mappings: ${e.message}`); }
    await migrationJournal.markOrgWideCompleted(org.key);
  }

  return result;
}
