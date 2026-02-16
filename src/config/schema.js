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
    }
  },
  additionalProperties: false
};
