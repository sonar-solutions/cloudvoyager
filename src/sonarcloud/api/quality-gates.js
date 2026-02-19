import logger from '../../utils/logger.js';

export async function createQualityGate(client, organization, name) {
  logger.info(`Creating quality gate: ${name}`);

  const response = await client.post('/api/qualitygates/create', null, {
    params: { name, organization }
  });

  return response.data;
}

export async function createQualityGateCondition(client, organization, gateId, metric, op, error) {
  logger.debug(`Creating gate condition: ${metric} ${op} ${error}`);

  const response = await client.post('/api/qualitygates/create_condition', null, {
    params: { gateId, metric, op, error, organization }
  });

  return response.data;
}

export async function setDefaultQualityGate(client, organization, id) {
  logger.info(`Setting default quality gate: ${id}`);

  await client.post('/api/qualitygates/set_as_default', null, {
    params: { id, organization }
  });
}

export async function assignQualityGateToProject(client, organization, gateId, projectKey) {
  logger.debug(`Assigning gate ${gateId} to project ${projectKey}`);

  await client.post('/api/qualitygates/select', null, {
    params: { gateId, projectKey, organization }
  });
}
