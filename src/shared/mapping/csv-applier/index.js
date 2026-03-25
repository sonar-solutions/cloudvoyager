// -------- CSV Override Applier --------
import { mapResourcesToOrganizations } from '../org-mapper.js';
import { applyProjectsCsv } from './helpers/apply-projects-csv.js';
import { applyGateMappingsCsv } from './helpers/apply-gate-mappings-csv.js';
import { applyProfileMappingsCsv } from './helpers/apply-profile-mappings-csv.js';
import { applyGroupMappingsCsv } from './helpers/apply-group-mappings-csv.js';
import { applyGlobalPermissionsCsv } from './helpers/apply-global-permissions-csv.js';
import { applyTemplateMappingsCsv } from './helpers/apply-template-mappings-csv.js';
import { applyPortfolioMappingsCsv } from './helpers/apply-portfolio-mappings-csv.js';
import { applyUserMappingsCsv } from './helpers/apply-user-mappings-csv.js';

export function applyCsvOverrides(parsedCsvs, extractedData, resourceMappings, orgAssignments) {
  const filtered = structuredClone(extractedData);
  let filteredAssignments = structuredClone(orgAssignments);
  let projectBranchIncludes = new Map();

  if (parsedCsvs.has('projects.csv')) {
    const r = applyProjectsCsv(parsedCsvs.get('projects.csv'), filteredAssignments);
    filteredAssignments = r.orgAssignments;
    projectBranchIncludes = r.projectBranchIncludes;
  }
  if (parsedCsvs.has('gate-mappings.csv')) filtered.qualityGates = applyGateMappingsCsv(parsedCsvs.get('gate-mappings.csv'), filtered.qualityGates);
  if (parsedCsvs.has('profile-mappings.csv')) filtered.qualityProfiles = applyProfileMappingsCsv(parsedCsvs.get('profile-mappings.csv'), filtered.qualityProfiles);
  if (parsedCsvs.has('group-mappings.csv')) filtered.groups = applyGroupMappingsCsv(parsedCsvs.get('group-mappings.csv'), filtered.groups);
  if (parsedCsvs.has('global-permissions.csv')) filtered.globalPermissions = applyGlobalPermissionsCsv(parsedCsvs.get('global-permissions.csv'), filtered.globalPermissions);
  if (parsedCsvs.has('template-mappings.csv')) filtered.permissionTemplates = applyTemplateMappingsCsv(parsedCsvs.get('template-mappings.csv'), filtered.permissionTemplates);
  if (parsedCsvs.has('portfolio-mappings.csv')) filtered.portfolios = applyPortfolioMappingsCsv(parsedCsvs.get('portfolio-mappings.csv'), filtered.portfolios);

  let userMappings = null;
  if (parsedCsvs.has('user-mappings.csv')) userMappings = applyUserMappingsCsv(parsedCsvs.get('user-mappings.csv'));

  const filteredResourceMappings = mapResourcesToOrganizations(filtered, filteredAssignments);
  return { filteredExtractedData: filtered, filteredResourceMappings, filteredOrgAssignments: filteredAssignments, projectBranchIncludes, userMappings };
}
