import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Set a quality gate as default in SonarCloud if it was default in SQ.
export async function setGateDefault(scGateId, gate, client) {
  if (!gate.isDefault) return;

  try {
    await client.setDefaultQualityGate(scGateId);
  } catch (error) {
    logger.warn(`Failed to set gate ${gate.name} as default: ${error.message}`);
  }
}
