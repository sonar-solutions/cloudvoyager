import { applyCsvOverrides } from '../../../../../../shared/mapping/csv-applier.js';
import logger from '../../../../../../shared/utils/logger.js';

// -------- Apply CSV Overrides --------

/** Apply CSV overrides and return filtered data + mappings. */
export function applyCsvOverridesToData(preExistingCsvs, extractedData, resourceMappings, orgAssignments, ctx) {
  logger.info('=== Applying CSV overrides from previous dry-run ===');
  const ov = applyCsvOverrides(preExistingCsvs, extractedData, resourceMappings, orgAssignments);

  ctx.projectBranchIncludes = ov.projectBranchIncludes || new Map();
  ctx.userMappings = ov.userMappings || null;

  const orig = orgAssignments.reduce((n, a) => n + a.projects.length, 0);
  const filt = ov.filteredOrgAssignments.reduce((n, a) => n + a.projects.length, 0);
  if (filt < orig) logger.info(`Projects: ${filt}/${orig} included after CSV filtering`);
  if (ctx.projectBranchIncludes.size > 0) logger.info(`Branch-level filtering active for ${ctx.projectBranchIncludes.size} project(s)`);
  logger.info('CSV overrides applied successfully');

  return {
    effectiveExtractedData: ov.filteredExtractedData,
    effectiveResourceMappings: ov.filteredResourceMappings,
    effectiveOrgAssignments: ov.filteredOrgAssignments,
  };
}
