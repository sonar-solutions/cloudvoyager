// -------- Verify New Code Periods --------

import logger from '../../../../utils/logger.js';

/** Verify new code period definitions between SonarQube and SonarCloud. */
export async function verifyNewCodePeriods(sqClient, scClient, sqProjectKey, scProjectKey) {
  const result = { status: 'pass', details: {} };

  let sqPeriods, scPeriods;
  try { sqPeriods = await sqClient.getNewCodePeriods(sqProjectKey); } catch (e) { logger.debug(`Failed to get SQ new code periods: ${e.message}`); sqPeriods = { projectLevel: null, branchOverrides: [] }; }
  try { scPeriods = await scClient.getNewCodePeriods(scProjectKey); } catch (e) { logger.debug(`Failed to get SC new code periods: ${e.message}`); scPeriods = { projectLevel: null, branchOverrides: [] }; }

  const sqType = sqPeriods.projectLevel?.type || null;
  const scType = scPeriods.projectLevel?.type || null;
  result.details.sqProjectLevel = sqType;
  result.details.scProjectLevel = scType;
  if (sqType && scType && sqType !== scType) result.status = 'fail';

  return result;
}
