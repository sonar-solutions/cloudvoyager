import { randomBytes } from 'node:crypto';
import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Attach utility methods to a builder instance.
export function attachUtilityMethods(instance) {
  instance.getComponentRef = (key) => {
    if (!instance.componentRefMap.has(key)) instance.componentRefMap.set(key, instance.nextRef++);
    return instance.componentRefMap.get(key);
  };
  instance.generateFakeCommitHash = () => { const h = randomBytes(20).toString('hex'); logger.debug(`Generated fake commit hash: ${h}`); return h; };
  instance.mapSeverity = (severity) => ({ 'INFO': 1, 'MINOR': 2, 'MAJOR': 3, 'CRITICAL': 4, 'BLOCKER': 5 }[severity] || 3);
  instance.buildPlugins = () => ({ 'javascript': { key: 'javascript', updatedAt: Date.now() } });
}
