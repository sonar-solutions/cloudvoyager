// -------- Build Environment --------
import { h } from './pdf-cell-helpers.js';

export function buildEnvironment(results) {
  const env = results.environment;
  if (!env) return [];
  const body = [
    [h('Property'), h('Value')],
    ['Platform', `${env.platform} (${env.arch})`],
    ['CPU', `${env.cpuModel} (${env.cpuCores} cores)`],
    ['Memory', `${Number(env.totalMemoryMB).toLocaleString('en-US')} MB`],
    ['Node.js', env.nodeVersion],
    ['Heap Limit', `${Number(env.heapLimitMB).toLocaleString('en-US')} MB`],
  ];
  return [
    { text: 'Runtime Environment', style: 'heading' },
    { table: { headerRows: 1, widths: [200, '*'], body }, layout: 'lightHorizontalLines' },
  ];
}
