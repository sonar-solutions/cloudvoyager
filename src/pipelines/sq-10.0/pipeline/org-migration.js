// -------- Re-export for backward compatibility --------

export {
  generateOrgMappings, saveServerInfo, runOrgStep,
  migrateOrgWideResources, migrateOneOrganization,
  migrateOneOrganizationCore, migrateOneOrganizationMetadata,
  migrateEnterprisePortfolios,
} from './org-migration/index.js';
