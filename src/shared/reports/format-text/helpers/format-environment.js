// -------- Format Environment --------
import { formatNumber } from '../../shared.js';

export function formatEnvironment(lines, results, subsep) {
  const env = results.environment;
  if (!env) return;
  lines.push('RUNTIME ENVIRONMENT', subsep);
  lines.push(`  Platform:     ${env.platform} (${env.arch})`);
  lines.push(`  CPU:          ${env.cpuModel} (${env.cpuCores} cores)`);
  lines.push(`  Memory:       ${formatNumber(env.totalMemoryMB)} MB total`);
  lines.push(`  Node.js:      ${env.nodeVersion}`);
  lines.push(`  Heap Limit:   ${formatNumber(env.heapLimitMB)} MB`);
  lines.push('');
}
