// -------- Log Phase Progress --------
import logger from '../../logger.js';
import { statusIcon } from './status-icon.js';

export function logPhaseProgress(journal) {
  if (!journal.phases) return;
  const phases = Object.entries(journal.phases);
  const completed = phases.filter(([, p]) => p.status === 'completed').length;
  const pct = phases.length > 0 ? Math.round((completed / phases.length) * 100) : 0;

  logger.info('');
  logger.info(`Phases: ${completed}/${phases.length} completed (${pct}%)`);
  logger.info('');
  for (const [name, phase] of phases) {
    logger.info(`  ${statusIcon(phase.status)} ${name}`);
  }
}
