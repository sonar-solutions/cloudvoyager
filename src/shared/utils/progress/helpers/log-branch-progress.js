// -------- Log Branch Progress --------
import logger from '../../logger.js';
import { statusIcon } from './status-icon.js';

export function logBranchProgress(journal) {
  if (!journal.branches || Object.keys(journal.branches).length === 0) return;
  const branches = Object.entries(journal.branches);
  const completed = branches.filter(([, b]) => b.status === 'completed').length;

  logger.info('');
  logger.info(`Branches: ${completed}/${branches.length} completed`);
  logger.info('');
  for (const [name, branch] of branches) {
    const detail = branch.currentPhase ? ` (at: ${branch.currentPhase})` : '';
    logger.info(`  ${statusIcon(branch.status)} ${name}${detail}`);
  }
}
