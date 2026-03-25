import { createAxiosClient } from './create-axios-client.js';
import { getPaginated } from './get-paginated.js';
import { attachProjectMethods } from './project-methods.js';
import { attachMeasureMethods } from './measure-methods.js';
import { attachSourceMethods } from './source-methods.js';
import { attachProfileRuleMethods } from './profile-rule-methods.js';
import { attachAnalysisMethods } from './analysis-methods.js';
import { attachIssueMethods } from './issue-methods.js';
import { attachDelegateMethods } from './delegate-methods.js';

// -------- Create SonarQube Client --------

/** Factory function: create a SonarQube API client instance. */
export function createSonarQubeClient(config) {
  const baseURL = config.url.replace(/\/$/, '');
  const client = createAxiosClient(baseURL, config.token);

  const inst = { baseURL, token: config.token, projectKey: config.projectKey, client };
  inst.getPaginated = (endpoint, params, dataKey) => getPaginated(client, endpoint, params, dataKey);

  attachProjectMethods(inst);
  attachMeasureMethods(inst);
  attachSourceMethods(inst);
  attachProfileRuleMethods(inst);
  attachAnalysisMethods(inst);
  attachIssueMethods(inst);
  attachDelegateMethods(inst);

  return inst;
}
