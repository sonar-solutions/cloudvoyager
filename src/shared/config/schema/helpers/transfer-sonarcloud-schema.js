// -------- Transfer SonarCloud Schema --------
export const transferSonarcloudSchema = {
  type: 'object',
  required: ['token', 'organization'],
  properties: {
    url: { type: 'string', format: 'uri', default: 'https://sonarcloud.io', description: 'SonarCloud server URL' },
    token: { type: 'string', minLength: 1, description: 'SonarCloud API token' },
    organization: { type: 'string', minLength: 1, description: 'SonarCloud organization key' },
    projectKey: { type: 'string', minLength: 1, description: 'SonarCloud project key (destination)' }
  },
  additionalProperties: false
};
