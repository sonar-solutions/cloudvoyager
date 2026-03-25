// -------- Verify Global Permissions --------

import logger from '../../../../utils/logger.js';
import { buildPermissionMap } from './build-permission-map.js';

const SC_UNSUPPORTED_PERMISSIONS = new Set(['applicationcreator', 'portfoliocreator']);

/** Verify global permissions between SonarQube and SonarCloud. */
export async function verifyGlobalPermissions(sqClient, scClient) {
  const result = { status: 'pass', mismatches: [], details: [] };
  const sqGroups = await sqClient.getGlobalPermissions();
  const scGroups = await scClient.getGlobalPermissions();
  const scPermMap = buildPermissionMap(scGroups);

  for (const sqGroup of sqGroups) {
    const sqPerms = (sqGroup.permissions || []).filter(p => !SC_UNSUPPORTED_PERMISSIONS.has(p)).sort();
    const scPerms = (scPermMap.get(sqGroup.name) || []).sort();
    const missing = sqPerms.filter(p => !scPerms.includes(p));
    if (missing.length > 0) result.mismatches.push({ group: sqGroup.name, missingPermissions: missing });
    result.details.push({
      group: sqGroup.name, sqPermissions: sqPerms, scPermissions: scPerms,
      status: missing.length === 0 ? 'pass' : 'fail',
    });
  }

  if (result.mismatches.length > 0) result.status = 'fail';
  logger.info(`Global permission verification: ${result.mismatches.length} groups with missing permissions`);
  return result;
}
