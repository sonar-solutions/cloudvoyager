// -------- Extract ALM Settings --------

import logger from '../../../../../../shared/utils/logger.js';

export async function extractAlmSettings(client) {
  const settings = await client.getAlmSettings();
  logger.info('Extracted ALM/DevOps platform settings');

  return {
    github: settings.github || [],
    gitlab: settings.gitlab || [],
    azure: settings.azure || [],
    bitbucket: settings.bitbucket || [],
    bitbucketcloud: settings.bitbucketcloud || []
  };
}
