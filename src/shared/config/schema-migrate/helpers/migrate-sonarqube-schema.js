// -------- Migrate SonarQube Schema --------
export const migrateSonarqubeSchema = {
  type: 'object',
  required: ['url', 'token'],
  properties: {
    url: { type: 'string', format: 'uri', description: 'SonarQube server URL' },
    token: { type: 'string', minLength: 1, description: 'SonarQube API token' }
  },
  additionalProperties: false
};
