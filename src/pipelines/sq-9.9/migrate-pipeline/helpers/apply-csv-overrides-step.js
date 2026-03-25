import logger from '../../../../shared/utils/logger.js';
import { applyCsvOverrides } from '../../../../shared/mapping/csv-applier.js';

// -------- Apply CSV Overrides from Previous Dry-Run --------

export function applyCsvOverridesStep(preExistingCsvs, extractedData, resourceMappings, orgAssignments, ctx) {
  if (!preExistingCsvs) {
    return { effectiveExtractedData: extractedData, effectiveResourceMappings: resourceMappings, effectiveOrgAssignments: orgAssignments };
  }

  logger.info('=== Applying CSV overrides from previous dry-run ===');
  const result = applyCsvOverrides(preExistingCsvs, extractedData, resourceMappings, orgAssignments);

  ctx.projectBranchIncludes = result.projectBranchIncludes || new Map();
  ctx.userMappings = result.userMappings || null;

  const origCount = orgAssignments.reduce((n, a) => n + a.projects.length, 0);
  const filteredCount = result.filteredOrgAssignments.reduce((n, a) => n + a.projects.length, 0);
  if (filteredCount < origCount) logger.info(`Projects: ${filteredCount}/${origCount} included after CSV filtering`);
  if (ctx.projectBranchIncludes.size > 0) logger.info(`Branch-level filtering active for ${ctx.projectBranchIncludes.size} project(s)`);
  logger.info('CSV overrides applied successfully');

  return {
    effectiveExtractedData: result.filteredExtractedData,
    effectiveResourceMappings: result.filteredResourceMappings,
    effectiveOrgAssignments: result.filteredOrgAssignments,
  };
}
