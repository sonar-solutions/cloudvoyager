// -------- Verify DevOps Binding --------

import logger from '../../../../utils/logger.js';

/** Verify DevOps/ALM binding for a project. */
export async function verifyDevOpsBinding(sqClient, scClient, sqProjectKey, scProjectKey) {
  const result = { status: 'pass', details: {} };

  let sqBinding, scBinding;
  try { sqBinding = await sqClient.getProjectBinding(sqProjectKey); } catch (e) { logger.debug(`Failed to get SQ binding: ${e.message}`); sqBinding = null; }
  try { scBinding = await scClient.getProjectBinding(scProjectKey); } catch (e) { logger.debug(`Failed to get SC binding: ${e.message}`); scBinding = null; }

  result.details.sqBinding = sqBinding ? { alm: sqBinding.alm, repository: sqBinding.repository } : null;
  result.details.scBinding = scBinding ? { alm: scBinding.alm, repository: scBinding.repository } : null;

  if (sqBinding && !scBinding) result.status = 'fail';
  else if (sqBinding && scBinding && sqBinding.repository !== scBinding.repository) result.status = 'fail';

  return result;
}
