// -------- Create Progress Logger --------
import logger from '../../logger.js';

export function createProgressLogger(label, total) {
  const interval = Math.max(10, Math.min(25, Math.floor(total / 50)));
  return (completed, _total) => {
    if (completed % interval === 0 || completed === total) {
      logger.info(`${label}: ${completed}/${total} (${Math.round(completed / total * 100)}%)`);
    }
  };
}
