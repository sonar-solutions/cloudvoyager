// -------- Collect Environment Info --------
import { availableParallelism as _availableParallelism, cpus, totalmem } from 'node:os';
import { getMemoryInfo } from './get-memory-info.js';

const availableParallelism = typeof _availableParallelism === 'function'
  ? _availableParallelism : () => cpus().length;

export function collectEnvironmentInfo() {
  const cpuInfo = cpus();
  const cpuModel = cpuInfo.length > 0 ? cpuInfo[0].model.trim() : 'Unknown';
  const cpuCount = availableParallelism();
  const totalMemMB = Math.round(totalmem() / 1024 / 1024);
  const memInfo = getMemoryInfo();
  return {
    platform: process.platform, arch: process.arch, cpuModel,
    cpuCores: cpuCount, totalMemoryMB: totalMemMB,
    nodeVersion: process.version, heapLimitMB: memInfo.heapSizeLimitMB
  };
}
