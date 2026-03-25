// -------- Resolve Pipeline ID --------

import logger from '../../shared/utils/logger.js';

export function resolvePipelineId(v) {
  if (v.major === 0 && v.minor === 0) {
    logger.warn('Could not determine SonarQube version. Falling back to sq-9.9 pipeline. This may produce incorrect results if the server is running a newer version.');
    return 'sq-9.9';
  }
  if (v.major >= 2025) return 'sq-2025';
  if ((v.major === 10 && v.minor >= 4) || (v.major > 10 && v.major < 2025)) return 'sq-10.4';
  if (v.major >= 10) return 'sq-10.0';
  return 'sq-9.9';
}
