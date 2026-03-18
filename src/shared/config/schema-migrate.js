import { performanceSchema, rateLimitSchema } from './schema-shared.js';

export const migrateConfigSchema = {
  type: 'object',
  required: ['sonarqube', 'sonarcloud'],
  properties: {
    sonarqube: {
      type: 'object',
      required: ['url', 'token'],
      properties: {
        url: { type: 'string', format: 'uri', description: 'SonarQube server URL' },
        token: { type: 'string', minLength: 1, description: 'SonarQube API token' }
      },
      additionalProperties: false
    },
    sonarcloud: {
      type: 'object',
      required: ['organizations'],
      properties: {
        enterprise: {
          type: 'object',
          properties: {
            key: { type: 'string', minLength: 1, description: 'SonarCloud enterprise key (required for portfolio migration)' }
          },
          required: ['key'],
          additionalProperties: false,
          description: 'SonarCloud enterprise configuration (for portfolio migration)'
        },
        organizations: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['key', 'token'],
            properties: {
              key: { type: 'string', minLength: 1, description: 'SonarCloud organization key' },
              token: { type: 'string', minLength: 1, description: 'SonarCloud API token' },
              url: { type: 'string', format: 'uri', default: 'https://sonarcloud.io', description: 'SonarCloud server URL' }
            },
            additionalProperties: false
          },
          description: 'Target SonarCloud organizations'
        }
      },
      additionalProperties: false
    },
    transfer: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['full', 'incremental'], default: 'full', description: 'Transfer mode' },
        batchSize: { type: 'integer', minimum: 1, maximum: 500, default: 100, description: 'Batch size' },
        syncAllBranches: { type: 'boolean', default: true, description: 'Sync all branches of every project (default: true). Set to false to only sync the main branch.' },
        excludeBranches: { type: 'array', items: { type: 'string' }, default: [], description: 'Branch names to exclude from sync when syncAllBranches is true' }
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
