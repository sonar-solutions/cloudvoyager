import logger from '../../utils/logger.js';

/**
 * Extract all quality gates with conditions and permissions
 * @param {import('../api-client.js').SonarQubeClient} client
 * @returns {Promise<Array>} Quality gates with full details
 */
export async function extractQualityGates(client) {
  const gatesData = await client.getQualityGates();
  const gates = gatesData.qualitygates || [];

  const defaultGate = gates.find(g => g.isDefault);
  logger.info(`Found ${gates.length} quality gates (default: ${defaultGate?.name || 'none'})`);

  const detailed = [];
  for (const gate of gates) {
    // Get conditions (using name as identifier)
    const details = await client.getQualityGateDetails(gate.name);

    // Get permissions
    const permissions = await client.getQualityGatePermissions(gate.name);

    detailed.push({
      name: gate.name,
      isDefault: gate.isDefault || false,
      isBuiltIn: gate.isBuiltIn || false,
      conditions: (details.conditions || []).map(c => ({
        id: c.id,
        metric: c.metric,
        op: c.op,
        error: c.error
      })),
      permissions
    });
  }

  return detailed;
}

/**
 * Extract quality gate assignment for a specific project
 * @param {import('../api-client.js').SonarQubeClient} client
 * @param {string} [projectKey] - Project key (defaults to client's projectKey)
 * @returns {Promise<object|null>} Quality gate assignment
 */
export async function extractProjectQualityGate(client, projectKey = null) {
  try {
    const gate = await client.getQualityGate();
    return gate;
  } catch (error) {
    logger.warn(`Failed to get quality gate for project: ${error.message}`);
    return null;
  }
}
