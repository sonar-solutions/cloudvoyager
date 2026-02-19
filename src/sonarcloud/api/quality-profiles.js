import logger from '../../utils/logger.js';

export async function getQualityProfiles(client, organization, projectKey) {
  logger.info('Fetching quality profiles from SonarCloud...');

  try {
    const response = await client.get('/api/qualityprofiles/search', {
      params: {
        project: projectKey,
        organization
      }
    });

    const profiles = response.data.profiles || [];
    logger.info(`Found ${profiles.length} quality profiles in SonarCloud`);
    return profiles;
  } catch (error) {
    logger.warn(`Failed to fetch quality profiles: ${error.message}`);
    return [];
  }
}

export async function getMainBranchName(client, projectKey) {
  try {
    logger.info('Fetching main branch name from SonarCloud...');
    const response = await client.get('/api/project_branches/list', {
      params: { project: projectKey }
    });

    const branches = response.data.branches || [];
    const mainBranch = branches.find(b => b.isMain);
    const branchName = mainBranch?.name || 'master';
    logger.info(`SonarCloud main branch: ${branchName}`);
    return branchName;
  } catch (error) {
    logger.warn(`Failed to fetch branch name from SonarCloud: ${error.message}, defaulting to 'master'`);
    return 'master';
  }
}

export async function restoreQualityProfile(client, organization, backupXml) {
  logger.info('Restoring quality profile from backup...');

  const FormData = (await import('form-data')).default;
  const form = new FormData();
  form.append('backup', Buffer.from(backupXml, 'utf-8'), {
    filename: 'profile-backup.xml',
    contentType: 'application/xml'
  });
  form.append('organization', organization);

  const response = await client.post('/api/qualityprofiles/restore', form, {
    headers: form.getHeaders()
  });

  return response.data;
}

export async function setDefaultQualityProfile(client, organization, language, qualityProfile) {
  logger.info(`Setting default profile for ${language}: ${qualityProfile}`);

  await client.post('/api/qualityprofiles/set_default', null, {
    params: { language, qualityProfile, organization }
  });
}

export async function addQualityProfileGroupPermission(client, organization, qualityProfile, language, group) {
  logger.debug(`Adding group ${group} permission to profile ${qualityProfile}`);

  await client.post('/api/qualityprofiles/add_group', null, {
    params: { qualityProfile, language, group, organization }
  });
}

export async function addQualityProfileUserPermission(client, organization, qualityProfile, language, login) {
  logger.debug(`Adding user ${login} permission to profile ${qualityProfile}`);

  await client.post('/api/qualityprofiles/add_user', null, {
    params: { qualityProfile, language, login, organization }
  });
}

export async function searchQualityProfiles(client, organization, language = null) {
  const params = { organization };
  if (language) params.language = language;

  const response = await client.get('/api/qualityprofiles/search', { params });
  return response.data.profiles || [];
}

export async function getActiveRules(client, organization, profileKey) {
  logger.debug(`Fetching active rules for SC profile: ${profileKey}`);

  let allRules = [];
  let page = 1;
  const pageSize = 100;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await client.get('/api/rules/search', {
      params: {
        qprofile: profileKey,
        organization,
        activation: 'true',
        ps: pageSize,
        p: page
      }
    });

    const rules = response.data.rules || [];
    allRules = allRules.concat(rules);

    const total = response.data.total || 0;
    if (page * pageSize >= total || rules.length < pageSize) break;
    page++;
  }

  logger.debug(`Retrieved ${allRules.length} active rules for profile ${profileKey}`);
  return allRules;
}

export async function addQualityProfileToProject(client, organization, language, qualityProfile, projectKey) {
  logger.debug(`Assigning profile "${qualityProfile}" (${language}) to project ${projectKey}`);

  await client.post('/api/qualityprofiles/add_project', null, {
    params: { language, qualityProfile, project: projectKey, organization }
  });
}
