// -------- Fetch Server Version --------

import axios from 'axios';
import logger from '../../shared/utils/logger.js';

export async function fetchServerVersion(config) {
  try {
    const response = await axios.get(`${config.url}/api/system/status`, {
      auth: { username: config.token, password: '' },
      timeout: 10000,
    });
    return response.data.version || 'unknown';
  } catch (error) {
    logger.warn(`Failed to detect SonarQube version: ${error.message}. Falling back to sq-9.9 pipeline.`);
    return 'unknown';
  }
}
