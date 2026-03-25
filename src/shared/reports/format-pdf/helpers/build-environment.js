// -------- Build Environment --------
import { formatNumber } from '../../shared.js';

export function buildEnvironment(results) {
  const env = results.environment;
  if (!env) return [];
  const body = [
    [{ text: 'Property', style: 'tableHeader' }, { text: 'Value', style: 'tableHeader' }],
    ['Platform', `${env.platform} (${env.arch})`],
    ['CPU', `${env.cpuModel} (${env.cpuCores} cores)`],
    ['Memory', `${formatNumber(env.totalMemoryMB)} MB`],
    ['Node.js', env.nodeVersion],
    ['Heap Limit', `${formatNumber(env.heapLimitMB)} MB`],
  ];
  return [
    { text: 'Runtime Environment', style: 'heading' },
    { table: { headerRows: 1, widths: [180, '*'], body }, layout: 'lightHorizontalLines' },
  ];
}
