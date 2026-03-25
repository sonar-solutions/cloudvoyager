import logger from '../../../../../../shared/utils/logger.js';

// -------- Profile Permissions --------

/** Set default quality profile for a language. */
export async function setDefaultQualityProfile(client, organization, language, qualityProfile) {
  logger.info(`Setting default profile for ${language}: ${qualityProfile}`);
  await client.post('/api/qualityprofiles/set_default', null, { params: { language, qualityProfile, organization } });
}

/** Add group permission to a quality profile. */
export async function addQualityProfileGroupPermission(client, organization, qualityProfile, language, group) {
  logger.debug(`Adding group ${group} permission to profile ${qualityProfile}`);
  await client.post('/api/qualityprofiles/add_group', null, { params: { qualityProfile, language, group, organization } });
}

/** Add user permission to a quality profile. */
export async function addQualityProfileUserPermission(client, organization, qualityProfile, language, login) {
  logger.debug(`Adding user ${login} permission to profile ${qualityProfile}`);
  await client.post('/api/qualityprofiles/add_user', null, { params: { qualityProfile, language, login, organization } });
}

/** Assign a quality profile to a project. */
export async function addQualityProfileToProject(client, organization, language, qualityProfile, projectKey) {
  logger.debug(`Assigning profile "${qualityProfile}" (${language}) to project ${projectKey}`);
  await client.post('/api/qualityprofiles/add_project', null, { params: { language, qualityProfile, project: projectKey, organization } });
}
