import { performanceSchema, rateLimitSchema } from './schema-shared.js';
export { migrateConfigSchema } from './schema-migrate.js';

export const configSchema = {
  type: 'object',
  required: ['sonarqube', 'sonarcloud'],
  properties: {
    sonarqube: {
      type: 'object',
      required: ['url', 'token'],
      properties: {
        url: { type: 'string', format: 'uri', description: 'SonarQube server URL' },
        token: { type: 'string', minLength: 1, description: 'SonarQube API token' },
        projectKey: { type: 'string', minLength: 1, description: 'SonarQube project key to export' }
      },
      additionalProperties: false
    },
    sonarcloud: {
      type: 'object',
      required: ['token', 'organization'],
      properties: {
        url: { type: 'string', format: 'uri', default: 'https://sonarcloud.io', description: 'SonarCloud server URL' },
        token: { type: 'string', minLength: 1, description: 'SonarCloud API token' },
        organization: { type: 'string', minLength: 1, description: 'SonarCloud organization key' },
        projectKey: { type: 'string', minLength: 1, description: 'SonarCloud project key (destination)' }
      },
      additionalProperties: false
    },
    transfer: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['full', 'incremental'], default: 'incremental', description: 'Transfer mode: full or incremental' },
        stateFile: { type: 'string', default: './.cloudvoyager-state.json', description: 'Path to state file for incremental transfers' },
        batchSize: { type: 'integer', minimum: 1, maximum: 500, default: 100, description: 'Number of items to process in each batch' },
        syncAllBranches: { type: 'boolean', default: true, description: 'Sync all branches of every project (default: true). Set to false to only sync the main branch.' },
        excludeBranches: { type: 'array', items: { type: 'string' }, default: [], description: 'Branch names to exclude from sync when syncAllBranches is true' }
      },
      additionalProperties: false
    },
    transferAll: {
      type: 'object',
      properties: {
        projectKeyPrefix: { type: 'string', default: '', description: 'Prefix to prepend to SonarQube project keys for SonarCloud' },
        projectKeyMapping: { type: 'object', additionalProperties: { type: 'string' }, default: {}, description: 'Explicit mapping from SonarQube project key to SonarCloud project key' },
        excludeProjects: { type: 'array', items: { type: 'string' }, default: [], description: 'SonarQube project keys to exclude from transfer-all' }
      },
      additionalProperties: false
    },
    migrate: {
      type: 'object',
      properties: {
        outputDir: { type: 'string', default: './migration-output', description: 'Directory for mapping CSVs and server info output' },
        skipIssueMetadataSync: { type: 'boolean', default: false, description: 'Skip syncing issue metadata (statuses, assignments, comments, tags)' },
        skipHotspotMetadataSync: { type: 'boolean', default: false, description: 'Skip syncing hotspot metadata (statuses, comments)' },
        skipQualityProfileSync: { type: 'boolean', default: false, description: 'Skip syncing quality profiles (projects use default SonarCloud profiles)' },
        dryRun: { type: 'boolean', default: false, description: 'Extract and generate mappings without migrating' }
      },
      additionalProperties: false
    },
    rateLimit: rateLimitSchema,
    performance: performanceSchema
  },
  additionalProperties: false
};
