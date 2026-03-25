// -------- Migrate SonarCloud Schema --------
export const migrateSonarcloudSchema = {
  type: 'object',
  required: ['organizations'],
  properties: {
    enterprise: {
      type: 'object',
      properties: { key: { type: 'string', minLength: 1, description: 'SonarCloud enterprise key (required for portfolio migration)' } },
      required: ['key'], additionalProperties: false,
      description: 'SonarCloud enterprise configuration (for portfolio migration)'
    },
    organizations: {
      type: 'array', minItems: 1,
      items: {
        type: 'object', required: ['key', 'token'],
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
};
