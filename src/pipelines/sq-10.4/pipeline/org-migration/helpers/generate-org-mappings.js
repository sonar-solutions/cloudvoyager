import { join } from 'node:path';
import { mapProjectsToOrganizations, mapResourcesToOrganizations } from '../../../../../shared/mapping/org-mapper.js';
import { generateMappingCsvs } from '../../../../../shared/mapping/csv-generator.js';

// -------- Main Logic --------

/**
 * Generate org mappings and CSV files for dry-run review.
 */
export async function generateOrgMappings(allProjects, extractedData, sonarcloudOrgs, outputDir, extraMappingData = {}) {
  const orgMapping = mapProjectsToOrganizations(allProjects, extractedData.projectBindings, sonarcloudOrgs);
  const resourceMappings = mapResourcesToOrganizations(extractedData, orgMapping.orgAssignments);

  await generateMappingCsvs({
    orgAssignments: orgMapping.orgAssignments,
    bindingGroups: orgMapping.bindingGroups,
    projectBindings: extractedData.projectBindings,
    projectMetadata: new Map(allProjects.map(p => [p.key, p])),
    projectBranches: extractedData.projectBranches || new Map(),
    resourceMappings, extractedData, ...extraMappingData,
  }, join(outputDir, 'mappings'));

  return { orgMapping, resourceMappings };
}
