import { applyCsvOverrides as applyCsv } from '../../../../shared/mapping/csv-applier.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Apply CSV overrides from a previous dry-run to filter/customize migration data.
 */
export function applyPreExistingCsvOverrides(preExistingCsvs, extractedData, resourceMappings, orgAssignments, ctx) {
  if (!preExistingCsvs) return { extractedData, resourceMappings, orgAssignments };

  logger.info('=== Applying CSV overrides from previous dry-run ===');
  const result = applyCsv(preExistingCsvs, extractedData, resourceMappings, orgAssignments);

  ctx.projectBranchIncludes = result.projectBranchIncludes || new Map();
  ctx.userMappings = result.userMappings || null;

  const origCount = orgAssignments.reduce((n, a) => n + a.projects.length, 0);
  const filteredCount = result.filteredOrgAssignments.reduce((n, a) => n + a.projects.length, 0);
  if (filteredCount < origCount) logger.info(`Projects: ${filteredCount}/${origCount} included after CSV filtering`);
  if (ctx.projectBranchIncludes.size > 0) logger.info(`Branch-level filtering active for ${ctx.projectBranchIncludes.size} project(s)`);
  logger.info('CSV overrides applied successfully');

  return {
    extractedData: result.filteredExtractedData,
    resourceMappings: result.filteredResourceMappings,
    orgAssignments: result.filteredOrgAssignments,
  };
}
