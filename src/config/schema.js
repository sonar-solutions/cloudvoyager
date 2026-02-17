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
        skipIssueSync: {
          type: 'boolean',
          default: false,
          description: 'Skip syncing issue statuses, assignments, and comments'
        },
        skipHotspotSync: {
          type: 'boolean',
          default: false,
          description: 'Skip syncing hotspot statuses and comments'
        },
        dryRun: {
          type: 'boolean',
          default: false,
          description: 'Extract and generate mappings without migrating'
        }
      },
      additionalProperties: false
    },
    rateLimit: rateLimitSchema
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
        skipIssueSync: {
          type: 'boolean',
          default: false,
          description: 'Skip syncing issue statuses, assignments, and comments'
        },
        skipHotspotSync: {
          type: 'boolean',
          default: false,
          description: 'Skip syncing hotspot statuses and comments'
        },
        dryRun: {
          type: 'boolean',
          default: false,
          description: 'Extract and generate mappings without migrating'
        }
      },
      additionalProperties: false
    },
    rateLimit: rateLimitSchema
  },
  additionalProperties: false
};
