import { grantProjectPermissions } from '../../../../../../shared/utils/permission-grants.js';

// -------- Grant All Project Permissions --------

export async function migrateProjectPermissions(projectKey, _projectPermissions, client) {
  await grantProjectPermissions(projectKey, client);
}
