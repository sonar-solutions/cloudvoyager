// -------- Format Environment --------
import { formatNumber } from '../../shared.js';

export function formatEnvironment(results) {
  const env = results.environment;
  if (!env) return null;
  const lines = [
    '## Runtime Environment\n',
    '| Property | Value |',
    '|----------|-------|',
    `| Platform | ${env.platform} (${env.arch}) |`,
    `| CPU | ${env.cpuModel} (${env.cpuCores} cores) |`,
    `| Memory | ${formatNumber(env.totalMemoryMB)} MB |`,
    `| Node.js | ${env.nodeVersion} |`,
    `| Heap Limit | ${formatNumber(env.heapLimitMB)} MB |`,
    '',
  ];
  return lines.join('\n');
}
