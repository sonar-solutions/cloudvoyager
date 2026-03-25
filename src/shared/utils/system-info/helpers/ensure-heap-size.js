// -------- Ensure Heap Size --------
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import v8 from 'node:v8';
import logger from '../../logger.js';

export function ensureHeapSize(maxMemoryMB) {
  if (!maxMemoryMB || maxMemoryMB <= 0) return;
  if (process.env.CLOUDVOYAGER_RESPAWNED) return;
  const isBunCompiled = process.argv.length >= 2 && process.argv[1].includes('$bunfs');
  if (isBunCompiled) return;

  const currentLimit = Math.round(v8.getHeapStatistics().heap_size_limit / 1024 / 1024);
  if (currentLimit >= maxMemoryMB) return;

  const existingNodeOptions = process.env.NODE_OPTIONS || '';
  const newNodeOptions = `${existingNodeOptions} --max-old-space-size=${maxMemoryMB}`.trim();
  logger.info(`Restarting with ${maxMemoryMB}MB heap (current: ${currentLimit}MB)...`);

  const isSEA = process.argv.length >= 2 && resolve(process.argv[0]) === resolve(process.argv[1]);
  const respawnArgs = process.argv.slice(isSEA ? 2 : 1);
  const result = spawnSync(process.execPath, respawnArgs, {
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: newNodeOptions, CLOUDVOYAGER_RESPAWNED: '1' }
  });
  process.exit(result.status ?? 1);
}
