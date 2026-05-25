// -------- Verify Global Permissions (Grant-All Mode) --------

import logger from '../../../../utils/logger.js';
import { buildPermissionMap } from './build-permission-map.js';
import { TARGET_PERMISSION_GROUP, ALL_GLOBAL_PERMISSIONS } from '../../../../utils/permission-constants.js';

export async function verifyGlobalPermissions(sqClient, scClient) {
  const result = { status: 'pass', mismatches: [], details: [] };
  const scGroups = await scClient.getGlobalPermissions();
  const scPermMap = buildPermissionMap(scGroups);
  const scPerms = (scPermMap.get(TARGET_PERMISSION_GROUP) || []).sort();
  const missing = ALL_GLOBAL_PERMISSIONS.filter(p => !scPerms.includes(p));

  result.details.push({
    group: TARGET_PERMISSION_GROUP,
    expectedPermissions: ALL_GLOBAL_PERMISSIONS,
    scPermissions: scPerms,
    status: missing.length === 0 ? 'pass' : 'fail',
  });

  if (missing.length > 0) {
    result.status = 'fail';
    result.mismatches.push({ group: TARGET_PERMISSION_GROUP, missingPermissions: missing });
  }

  logger.info(`Global permission verification (grant-all): ${missing.length === 0 ? 'pass' : `${missing.length} missing`}`);
  return result;
}
