// -------- Get Memory Info --------
import v8 from 'node:v8';

export function getMemoryInfo() {
  const heapStats = v8.getHeapStatistics();
  return {
    heapSizeLimitMB: Math.round(heapStats.heap_size_limit / 1024 / 1024),
    usedHeapMB: Math.round(heapStats.used_heap_size / 1024 / 1024),
    totalHeapMB: Math.round(heapStats.total_heap_size / 1024 / 1024)
  };
}
