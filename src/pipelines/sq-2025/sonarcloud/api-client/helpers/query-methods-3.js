import logger from '../../../../../shared/utils/logger.js';
import { getPaginated } from './query-methods.js';

// -------- Read-Only Query Methods (Part 3: Permissions & Groups) --------

/** Get ALM binding for a project. */
export async function getProjectBinding(client, projectKey) {
  try {
    const response = await client.get('/api/alm_settings/get_binding', { params: { project: projectKey } });
    return response.data;
  } catch (error) {
    logger.debug(`No binding found for project ${projectKey}: ${error.message}`);
    return null;
  }
}

/** Get all groups in the organization. */
export async function getGroups(client, organization) {
  return getPaginated(client, '/api/user_groups/search', { organization }, 'groups');
}

/** Get global permission groups. */
export async function getGlobalPermissions(client, organization) {
  return getPaginated(client, '/api/permissions/groups', { organization, ps: 100 }, 'groups');
}

/** Get project-level permission groups. */
export async function getProjectPermissions(client, projectKey, organization) {
  return getPaginated(client, '/api/permissions/groups', { projectKey, organization, ps: 100 }, 'groups');
}

/** Get permission templates. */
export async function getPermissionTemplates(client, organization) {
  const response = await client.get('/api/permissions/search_templates', { params: { organization } });
  return response.data;
}
