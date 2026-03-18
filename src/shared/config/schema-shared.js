export const performanceSchema = {
  type: 'object',
  properties: {
    autoTune: {
      type: 'boolean', default: false,
      description: 'Automatically detect CPU and RAM and set optimal performance values. Explicit settings override auto-tuned values.'
    },
    maxConcurrency: {
      type: 'integer', minimum: 1, maximum: 64, default: 8,
      description: 'General concurrency limit for parallel I/O operations'
    },
    maxMemoryMB: {
      type: 'integer', minimum: 0, maximum: 32768, default: 0,
      description: 'Max heap size in MB (0 = Node.js default). Auto-restarts the process with increased heap if needed.'
    },
    sourceExtraction: {
      type: 'object',
      properties: {
        concurrency: { type: 'integer', minimum: 1, maximum: 50, default: 10, description: 'Max concurrent source file fetches from SonarQube' }
      },
      additionalProperties: false
    },
    hotspotExtraction: {
      type: 'object',
      properties: {
        concurrency: { type: 'integer', minimum: 1, maximum: 50, default: 10, description: 'Max concurrent hotspot detail fetches from SonarQube' }
      },
      additionalProperties: false
    },
    issueSync: {
      type: 'object',
      properties: {
        concurrency: { type: 'integer', minimum: 1, maximum: 20, default: 5, description: 'Max concurrent issue metadata sync operations to SonarCloud' }
      },
      additionalProperties: false
    },
    hotspotSync: {
      type: 'object',
      properties: {
        concurrency: { type: 'integer', minimum: 1, maximum: 20, default: 3, description: 'Max concurrent hotspot sync operations to SonarCloud (lower default due to rate limiting)' }
      },
      additionalProperties: false
    },
    projectMigration: {
      type: 'object',
      properties: {
        concurrency: { type: 'integer', minimum: 1, maximum: 8, default: 1, description: 'Max concurrent project migrations (1 = sequential, backward-compatible)' }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};

export const rateLimitSchema = {
  type: 'object',
  properties: {
    maxRetries: {
      type: 'integer', minimum: 0, maximum: 20, default: 3,
      description: 'Max retry attempts on 503/429 rate limit errors (0 = no retries)'
    },
    baseDelay: {
      type: 'integer', minimum: 0, maximum: 60000, default: 1000,
      description: 'Initial delay in ms before first retry (doubles each retry: 1000 -> 1s, 2s, 4s, 8s, 16s)'
    },
    minRequestInterval: {
      type: 'integer', minimum: 0, maximum: 10000, default: 0,
      description: 'Minimum ms between POST requests (0 = no throttling)'
    }
  },
  additionalProperties: false
};
