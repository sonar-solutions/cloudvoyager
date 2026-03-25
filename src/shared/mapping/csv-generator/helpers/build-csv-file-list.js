// -------- Build CSV File List --------
import { generateGroupMappingsCsv, generateProfileMappingsCsv, generateGateMappingsCsv, generatePortfolioMappingsCsv, generateTemplateMappingsCsv, generateGlobalPermissionsCsv, generateUserMappingsCsv } from '../../csv-tables.js';
import { generateOrganizationsCsv } from './generate-organizations-csv.js';
import { generateProjectsCsv } from './generate-projects-csv.js';

export function buildCsvFileList(mappingData) {
  return [
    { name: 'organizations.csv', fn: () => generateOrganizationsCsv(mappingData) },
    { name: 'projects.csv', fn: () => generateProjectsCsv(mappingData) },
    { name: 'group-mappings.csv', fn: () => generateGroupMappingsCsv(mappingData) },
    { name: 'profile-mappings.csv', fn: () => generateProfileMappingsCsv(mappingData) },
    { name: 'gate-mappings.csv', fn: () => generateGateMappingsCsv(mappingData) },
    { name: 'portfolio-mappings.csv', fn: () => generatePortfolioMappingsCsv(mappingData) },
    { name: 'template-mappings.csv', fn: () => generateTemplateMappingsCsv(mappingData) },
    { name: 'global-permissions.csv', fn: () => generateGlobalPermissionsCsv(mappingData) },
    { name: 'user-mappings.csv', fn: () => generateUserMappingsCsv(mappingData) }
  ];
}
