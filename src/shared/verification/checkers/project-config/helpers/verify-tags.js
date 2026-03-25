// -------- Verify Project Tags --------

import logger from '../../../../utils/logger.js';

/** Verify project tags between SonarQube and SonarCloud. */
export async function verifyProjectTags(sqClient, scClient, scProjectKey) {
  const result = { status: 'pass', sqTags: [], scTags: [], missing: [], extra: [] };

  try { const p = await sqClient.getProject(); result.sqTags = (p.tags || []).sort(); } catch (e) { logger.debug(`Failed to get SQ project tags: ${e.message}`); }
  try { result.scTags = (await scClient.getProjectTagsForProject(scProjectKey)).sort(); } catch (e) { logger.debug(`Failed to get SC project tags: ${e.message}`); }

  const sqSet = new Set(result.sqTags);
  const scSet = new Set(result.scTags);
  for (const tag of result.sqTags) { if (!scSet.has(tag)) result.missing.push(tag); }
  for (const tag of result.scTags) { if (!sqSet.has(tag)) result.extra.push(tag); }
  if (result.missing.length > 0) result.status = 'fail';

  return result;
}
