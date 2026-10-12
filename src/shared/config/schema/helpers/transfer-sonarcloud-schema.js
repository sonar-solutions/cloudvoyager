// -------- Transfer SonarCloud Schema --------
export const transferSonarcloudSchema = {
  type: 'object',
  required: ['organization'],
  properties: {
    url: { type: 'string', format: 'uri', default: 'https://sonarcloud.io', description: 'SonarCloud server URL' },
    token: { type: 'string', minLength: 1, description: 'SonarCloud API token (single)' },
    tokens: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 1, description: 'SonarCloud API tokens (multiple — spreads API load)' },
    organization: { type: 'string', minLength: 1, description: 'SonarCloud organization key' },
    projectKey: { type: 'string', minLength: 1, description: 'SonarCloud project key (destination)' }
  },
  additionalProperties: false
};
