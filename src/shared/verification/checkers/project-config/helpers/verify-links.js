// -------- Verify Project Links --------

import logger from '../../../../utils/logger.js';

/** Verify project links between SonarQube and SonarCloud. */
export async function verifyProjectLinks(sqClient, scClient, sqProjectKey, scProjectKey) {
  const result = { status: 'pass', sqCount: 0, scCount: 0, missing: [], details: [] };

  let sqLinks, scLinks;
  try { sqLinks = await sqClient.getProjectLinks(sqProjectKey); } catch (e) { logger.debug(`Failed to get SQ project links: ${e.message}`); sqLinks = []; }
  try { scLinks = await scClient.getProjectLinks(scProjectKey); } catch (e) { logger.debug(`Failed to get SC project links: ${e.message}`); scLinks = []; }

  result.sqCount = sqLinks.length;
  result.scCount = scLinks.length;
  const scLinkMap = new Map(scLinks.map(l => [`${l.name}|${l.url}`, l]));

  for (const sqLink of sqLinks) {
    if (!scLinkMap.has(`${sqLink.name}|${sqLink.url}`)) {
      result.missing.push({ name: sqLink.name, url: sqLink.url });
    }
  }

  if (result.missing.length > 0) result.status = 'fail';
  return result;
}
