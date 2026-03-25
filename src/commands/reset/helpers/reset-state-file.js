// -------- Reset State File --------

import { StateTracker } from '../../../shared/state/tracker.js';
import logger from '../../../shared/utils/logger.js';

export async function resetStateFile(stateFile) {
  const stateTracker = new StateTracker(stateFile);
  await stateTracker.reset();
  logger.info('State file reset successfully');
}
