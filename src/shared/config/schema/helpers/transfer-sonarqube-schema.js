// -------- Transfer SonarQube Schema --------
export const transferSonarqubeSchema = {
  type: 'object',
  required: ['url', 'token'],
  properties: {
    url: { type: 'string', format: 'uri', description: 'SonarQube server URL' },
    token: { type: 'string', minLength: 1, description: 'SonarQube API token' },
    projectKey: { type: 'string', minLength: 1, description: 'SonarQube project key to export' }
  },
  additionalProperties: false
};
