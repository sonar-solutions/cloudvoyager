/**
 * Shared performance schema for CPU, memory, and concurrency tuning
 */
const performanceSchema = {
  type: 'object',
  properties: {
    autoTune: {
      type: 'boolean',
      default: false,
      description: 'Automatically detect CPU and RAM and set optimal performance values. Explicit settings override auto-tuned values.'
    },
    maxConcurrency: {
      type: 'integer',
      minimum: 1,
      maximum: 64,
      default: 8,
      description: 'General concurrency limit for parallel I/O operations'
    },
    maxMemoryMB: {
      type: 'integer',
      minimum: 256,
      maximum: 32768,
      default: 0,
      description: 'Max heap size in MB (0 = Node.js default). Auto-restarts the process with increased heap if needed.'
    },
    sourceExtraction: {
      type: 'object',
      properties: {
        concurrency: {
          type: 'integer',
          minimum: 1,
          maximum: 50,
          default: 10,
          description: 'Max concurrent source file fetches from SonarQube'
        }
      },
      additionalProperties: false
    },
    hotspotExtraction: {
      type: 'object',
      properties: {
        concurrency: {
          type: 'integer',
          minimum: 1,
          maximum: 50,
          default: 10,
          description: 'Max concurrent hotspot detail fetches from SonarQube'
        }
      },
      additionalProperties: false
    },
    issueSync: {
      type: 'object',
      properties: {
        concurrency: {
          type: 'integer',
          minimum: 1,
          maximum: 20,
          default: 5,
          description: 'Max concurrent issue metadata sync operations to SonarCloud'
        }
      },
      additionalProperties: false
    },
    hotspotSync: {
      type: 'object',
      properties: {
        concurrency: {
          type: 'integer',
          minimum: 1,
          maximum: 20,
          default: 3,
          description: 'Max concurrent hotspot sync operations to SonarCloud (lower default due to rate limiting)'
        }
      },
      additionalProperties: false
    },
    projectMigration: {
      type: 'object',
      properties: {
        concurrency: {
          type: 'integer',
          minimum: 1,
          maximum: 8,
          default: 1,
          description: 'Max concurrent project migrations (1 = sequential, backward-compatible)'
        }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};

/**
 * Shared rateLimit schema used by both configSchema and migrateConfigSchema
 */
const rateLimitSchema = {
  type: 'object',
  properties: {
    maxRetries: {
      type: 'integer',
      minimum: 0,
      maximum: 20,
      default: 3,
      description: 'Max retry attempts on 503/429 rate limit errors (0 = no retries)'
    },
    baseDelay: {
      type: 'integer',
      minimum: 0,
      maximum: 60000,
      default: 1000,
      description: 'Initial delay in ms before first retry (doubles each retry: 1000 -> 1s, 2s, 4s, 8s, 16s)'
    },
    minRequestInterval: {
      type: 'integer',
      minimum: 0,
      maximum: 10000,
      default: 0,
      description: 'Minimum ms between POST requests (0 = no throttling)'
    }
  },
  additionalProperties: false
};

/**
 * JSON schema for configuration validation
 */
export const configSchema = {
  type: 'object',
  required: ['sonarqube', 'sonarcloud'],
  properties: {
    sonarqube: {
      type: 'object',
      required: ['url', 'token'],
      properties: {
        url: {
          type: 'string',
          format: 'uri',
          description: 'SonarQube server URL'
        },
        token: {
          type: 'string',
          minLength: 1,
          description: 'SonarQube API token'
        },
        projectKey: {
          type: 'string',
          minLength: 1,
          description: 'SonarQube project key to export'
        }
      },
      additionalProperties: false
    },
    sonarcloud: {
      type: 'object',
      required: ['token', 'organization'],
      properties: {
        url: {
          type: 'string',
          format: 'uri',
          default: 'https://sonarcloud.io',
          description: 'SonarCloud server URL'
        },
        token: {
          type: 'string',
          minLength: 1,
          description: 'SonarCloud API token'
        },
        organization: {
          type: 'string',
          minLength: 1,
          description: 'SonarCloud organization key'
        },
        projectKey: {
          type: 'string',
          minLength: 1,
          description: 'SonarCloud project key (destination)'
        }
      },
      additionalProperties: false
    },
    transfer: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['full', 'incremental'],
          default: 'incremental',
          description: 'Transfer mode: full or incremental'
        },
        stateFile: {
          type: 'string',
          default: './.cloudvoyager-state.json',
          description: 'Path to state file for incremental transfers'
        },
        batchSize: {
          type: 'integer',
          minimum: 1,
          maximum: 500,
          default: 100,
          description: 'Number of items to process in each batch'
        }
      },
      additionalProperties: false
    },
    transferAll: {
      type: 'object',
      properties: {
        projectKeyPrefix: {
          type: 'string',
          default: '',
          description: 'Prefix to prepend to SonarQube project keys for SonarCloud'
        },
        projectKeyMapping: {
          type: 'object',
          additionalProperties: { type: 'string' },
          default: {},
          description: 'Explicit mapping from SonarQube project key to SonarCloud project key'
        },
        excludeProjects: {
          type: 'array',
          items: { type: 'string' },
          default: [],
          description: 'SonarQube project keys to exclude from transfer-all'
        }
      },
      additionalProperties: false
    },
    migrate: {
      type: 'object',
      properties: {
        outputDir: {
          type: 'string',
          default: './migration-output',
          description: 'Directory for mapping CSVs and server info output'
        },
        skipIssueMetadataSync: {
          type: 'boolean',
          default: false,
          description: 'Skip syncing issue metadata (statuses, assignments, comments, tags)'
        },
        skipHotspotMetadataSync: {
          type: 'boolean',
          default: false,
          description: 'Skip syncing hotspot metadata (statuses, comments)'
        },
        dryRun: {
          type: 'boolean',
          default: false,
          description: 'Extract and generate mappings without migrating'
        }
      },
      additionalProperties: false
    },
    rateLimit: rateLimitSchema,
    performance: performanceSchema
  },
  additionalProperties: false
};

/**
 * JSON schema for multi-org migration configuration
 * Used by the `migrate` command which supports multiple target SonarCloud organizations
 */
export const migrateConfigSchema = {
  type: 'object',
  required: ['sonarqube', 'sonarcloud'],
  properties: {
    sonarqube: {
      type: 'object',
      required: ['url', 'token'],
      properties: {
        url: {
          type: 'string',
          format: 'uri',
          description: 'SonarQube server URL'
        },
        token: {
          type: 'string',
          minLength: 1,
          description: 'SonarQube API token'
        }
      },
      additionalProperties: false
    },
    sonarcloud: {
      type: 'object',
      required: ['organizations'],
      properties: {
        organizations: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['key', 'token'],
            properties: {
              key: {
                type: 'string',
                minLength: 1,
                description: 'SonarCloud organization key'
              },
              token: {
                type: 'string',
                minLength: 1,
                description: 'SonarCloud API token'
              },
              url: {
                type: 'string',
                format: 'uri',
                default: 'https://sonarcloud.io',
                description: 'SonarCloud server URL'
              }
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
        mode: {
          type: 'string',
          enum: ['full', 'incremental'],
          default: 'full',
          description: 'Transfer mode'
        },
        batchSize: {
          type: 'integer',
          minimum: 1,
          maximum: 500,
          default: 100,
          description: 'Batch size'
        }
      },
      additionalProperties: false
    },
    migrate: {
      type: 'object',
      properties: {
        outputDir: {
          type: 'string',
          default: './migration-output',
          description: 'Directory for mapping CSVs and server info output'
        },
        skipIssueMetadataSync: {
          type: 'boolean',
          default: false,
          description: 'Skip syncing issue metadata (statuses, assignments, comments, tags)'
        },
        skipHotspotMetadataSync: {
          type: 'boolean',
          default: false,
          description: 'Skip syncing hotspot metadata (statuses, comments)'
        },
        dryRun: {
          type: 'boolean',
          default: false,
          description: 'Extract and generate mappings without migrating'
        }
      },
      additionalProperties: false
    },
    rateLimit: rateLimitSchema,
    performance: performanceSchema
  },
  additionalProperties: false
};
