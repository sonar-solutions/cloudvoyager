import { saveServerInfo } from '../../../pipeline/org-migration.js';
import { applyCsvOverridesToData } from './helpers/apply-csv-overrides-to-data.js';
import { runOrgMigrations } from './helpers/run-org-migrations.js';

// -------- Apply CSV Overrides and Run Migration --------

/** Apply CSV overrides, run org migrations, portfolios, and metadata sync. */
export async function applyCsvAndMigrate(orgMapping, resourceMappings, extractedData, preExistingCsvs, results, ctx) {
  let effectiveExtractedData = extractedData;
  let effectiveResourceMappings = resourceMappings;
  let effectiveOrgAssignments = orgMapping.orgAssignments;

  if (preExistingCsvs) {
    const ov = applyCsvOverridesToData(preExistingCsvs, extractedData, resourceMappings, orgMapping.orgAssignments, ctx);
    effectiveExtractedData = ov.effectiveExtractedData;
    effectiveResourceMappings = ov.effectiveResourceMappings;
    effectiveOrgAssignments = ov.effectiveOrgAssignments;
  }

  await saveServerInfo(ctx.outputDir, extractedData);
  if (ctx.migrationJournal) await ctx.migrationJournal.seedOrganizations(effectiveOrgAssignments);

  await runOrgMigrations(effectiveOrgAssignments, effectiveExtractedData, effectiveResourceMappings, results, ctx);
}
