// -------- Verify Permission Templates --------

import logger from '../../../../utils/logger.js';

/** Verify permission templates between SonarQube and SonarCloud. */
export async function verifyPermissionTemplates(sqClient, scClient) {
  const result = { status: 'pass', sqCount: 0, scCount: 0, missing: [], details: [] };

  let sqData, scData;
  try { sqData = await sqClient.getPermissionTemplates(); } catch (e) { logger.debug(`Failed to get SQ permission templates: ${e.message}`); sqData = { permissionTemplates: [] }; }
  try { scData = await scClient.getPermissionTemplates(); } catch (e) { logger.debug(`Failed to get SC permission templates: ${e.message}`); scData = { permissionTemplates: [] }; }

  const sqTemplates = sqData.permissionTemplates || [];
  const scTemplates = scData.permissionTemplates || [];
  result.sqCount = sqTemplates.length;
  result.scCount = scTemplates.length;

  const scNames = new Set(scTemplates.map(t => t.name));
  for (const t of sqTemplates) {
    const found = scNames.has(t.name);
    result.details.push({ name: t.name, status: found ? 'pass' : 'fail' });
    if (!found) result.missing.push(t.name);
  }

  if (result.missing.length > 0) result.status = 'fail';
  logger.info(`Permission template verification: SQ=${result.sqCount}, SC=${result.scCount}, missing=${result.missing.length}`);
  return result;
}
