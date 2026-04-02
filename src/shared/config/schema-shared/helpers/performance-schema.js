// -------- Performance Schema --------
export const performanceSchema = {
  type: 'object',
  properties: {
    autoTune: { type: 'boolean', default: false, description: 'Automatically detect CPU and RAM and set optimal performance values.' },
    maxConcurrency: { type: 'integer', minimum: 1, maximum: 128, default: 64, description: 'General concurrency limit for parallel I/O operations' },
    maxMemoryMB: { type: 'integer', minimum: 0, maximum: 32768, default: 8192, description: 'Max heap size in MB (0 = Node.js default).' },
    sourceExtraction: {
      type: 'object', additionalProperties: false,
      properties: { concurrency: { type: 'integer', minimum: 1, maximum: 100, default: 50, description: 'Max concurrent source file fetches from SonarQube' } }
    },
    hotspotExtraction: {
      type: 'object', additionalProperties: false,
      properties: { concurrency: { type: 'integer', minimum: 1, maximum: 100, default: 50, description: 'Max concurrent hotspot detail fetches from SonarQube' } }
    },
    issueSync: {
      type: 'object', additionalProperties: false,
      properties: { concurrency: { type: 'integer', minimum: 1, maximum: 50, default: 20, description: 'Max concurrent issue metadata sync operations to SonarCloud' } }
    },
    hotspotSync: {
      type: 'object', additionalProperties: false,
      properties: { concurrency: { type: 'integer', minimum: 1, maximum: 50, default: 20, description: 'Max concurrent hotspot sync operations to SonarCloud' } }
    },
    projectMigration: {
      type: 'object', additionalProperties: false,
      properties: { concurrency: { type: 'integer', minimum: 1, maximum: 16, default: 8, description: 'Max concurrent project migrations' } }
    },
    projectVerification: {
      type: 'object', additionalProperties: false,
      properties: { concurrency: { type: 'integer', minimum: 1, maximum: 16, default: 3, description: 'Max concurrent project verifications' } }
    },
    dateWindowSlicing: {
      type: 'object', additionalProperties: false,
      properties: { concurrency: { type: 'integer', minimum: 1, maximum: 12, default: 6, description: 'Max concurrent date-window fetches when slicing large result sets (>10K items)' } }
    },
    permissionSync: {
      type: 'object', additionalProperties: false,
      properties: { concurrency: { type: 'integer', minimum: 1, maximum: 50, default: 10, description: 'Max concurrent permission API calls during migration' } }
    },
    settingsSync: {
      type: 'object', additionalProperties: false,
      properties: { concurrency: { type: 'integer', minimum: 1, maximum: 50, default: 10, description: 'Max concurrent project setting API calls during migration' } }
    }
  },
  additionalProperties: false
};
