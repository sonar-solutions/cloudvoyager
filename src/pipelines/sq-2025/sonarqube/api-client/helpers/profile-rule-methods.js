import logger from '../../../../../shared/utils/logger.js';

// -------- Profile & Rule Methods --------

/** Attach quality profile and rule methods to the client instance. */
export function attachProfileRuleMethods(inst) {
  inst.getQualityProfiles = async () => {
    logger.info(`Fetching quality profiles for project: ${inst.projectKey}`);
    const response = await inst.client.get('/api/qualityprofiles/search', { params: { project: inst.projectKey } });
    return response.data.profiles || [];
  };

  inst.getActiveRules = async (profileKey) => {
    logger.debug(`Fetching active rules for profile: ${profileKey}`);
    return await inst.getPaginated('/api/rules/search', { qprofile: profileKey, ps: 100 }, 'rules');
  };
}
