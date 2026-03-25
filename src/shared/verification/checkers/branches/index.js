// -------- Verify Branches --------

import logger from '../../../utils/logger.js';
import { compareBranches } from './helpers/compare-branches.js';

/**
 * Verify branches between SonarQube and SonarCloud for a project.
 */
export async function verifyBranches(sqClient, scClient, scProjectKey) {
  const result = { status: 'pass', sqCount: 0, scCount: 0, missing: [], extra: [] };

  const sqBranches = await sqClient.getBranches();
  const scBranches = await scClient.getProjectBranches(scProjectKey);
  const comparison = compareBranches(sqBranches, scBranches);

  result.sqCount = comparison.sqCount;
  result.scCount = comparison.scCount;
  result.missing = comparison.missing;
  result.extra = comparison.extra;

  if (result.missing.length > 0) result.status = 'fail';
  logger.info(`Branch verification: SQ=${result.sqCount}, SC=${result.scCount}, missing=${result.missing.length}, extra=${result.extra.length}`);
  return result;
}
