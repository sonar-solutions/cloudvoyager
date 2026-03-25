import logger from '../../../../../../shared/utils/logger.js';

// -------- Add Template Group Permissions --------

/** Add group permissions to a permission template. */
export async function addTemplateGroupPermissions(scTemplateId, permissions, client) {
  for (const perm of permissions) {
    if (perm.groupsCount <= 0) continue;

    for (const groupName of (perm.groups || [])) {
      try {
        await client.addGroupToTemplate(scTemplateId, groupName, perm.key);
      } catch (error) {
        logger.debug(`Failed to add group ${groupName} to template: ${error.message}`);
      }
    }
  }
}
