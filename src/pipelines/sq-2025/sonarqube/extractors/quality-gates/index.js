import logger from '../../../../../shared/utils/logger.js';
import { extractQualityGateDetails } from './helpers/extract-quality-gate-details.js';

// -------- Quality Gates Extraction --------

/** Extract all quality gates with conditions and permissions. */
export async function extractQualityGates(client) {
  const gatesData = await client.getQualityGates();
  const gates = gatesData.qualitygates || [];
  const defaultGate = gates.find(g => g.isDefault);
  logger.info(`Found ${gates.length} quality gates (default: ${defaultGate?.name || 'none'})`);

  const detailed = [];
  for (const gate of gates) {
    detailed.push(await extractQualityGateDetails(client, gate));
  }
  return detailed;
}

/** Extract quality gate assignment for a specific project. */
export async function extractProjectQualityGate(client, projectKey = null) {
  try {
    return await client.getQualityGate();
  } catch (error) {
    logger.warn(`Failed to get quality gate for project: ${error.message}`);
    return null;
  }
}
