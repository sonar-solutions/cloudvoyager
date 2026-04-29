import { createHttpClient } from './create-http-client.js';
import { handleApiError } from './handle-api-error.js';
import { getPaginated } from './get-paginated.js';
import { buildProjectMethods } from './project-methods.js';
import { buildQualityMethods } from './quality-methods.js';
import { buildMeasureMethods } from './measure-methods.js';
import { buildSourceMethods } from './source-methods.js';
import { buildConnectionMethods } from './connection-methods.js';
import { buildDelegateMethods } from './delegate-methods.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Factory function to create a SonarQube API client.
export function createSonarQubeClient(config) {
  const baseURL = config.url.replace(/\/$/, '');
  const client = createHttpClient(baseURL, config.token);
  logger.info(`OKO Created SonarQube client for ${baseURL} with token: ${client.token}`);
  const projectKey = config.projectKey;

  const gp = (endpoint, params, dataKey) => getPaginated(client, endpoint, params, dataKey);

  const projectMethods = buildProjectMethods(client, projectKey);
  // Wire listAllProjects to use gp
  projectMethods.listAllProjects = () => gp('/api/projects/search', {}, 'components');

  const instance = {
    baseURL, token: config.token, projectKey, client,
    handleError: (error) => handleApiError(error, instance.baseURL),
    getPaginated: gp,
    getLatestAnalysisRevision: () => buildConnectionMethods(client).getLatestAnalysisRevision(projectKey),
    ...projectMethods,
    ...buildQualityMethods(client, projectKey, gp),
    ...buildMeasureMethods(client, projectKey, gp),
    ...buildSourceMethods(client, projectKey, gp),
    ...buildConnectionMethods(client),
    ...buildDelegateMethods(client, projectKey, gp),
  };

  return instance;
}
