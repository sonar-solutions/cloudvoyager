// -------- Verify Project Quality Gate --------

import logger from '../../../../utils/logger.js';

/** Verify quality gate assignment for a project. */
export async function verifyProjectQualityGate(sqClient, scClient, scProjectKey) {
  const result = { status: 'pass', sqGate: null, scGate: null };

  try { const g = await sqClient.getQualityGate(); result.sqGate = g?.name || null; } catch (e) { logger.debug(`Failed to get SQ quality gate: ${e.message}`); }
  try { const g = await scClient.getQualityGateForProject(scProjectKey); result.scGate = g?.name || null; } catch (e) { logger.debug(`Failed to get SC quality gate: ${e.message}`); }

  if (result.sqGate && result.scGate && result.sqGate !== result.scGate) result.status = 'fail';
  else if (result.sqGate && !result.scGate) result.status = 'fail';

  return result;
}
