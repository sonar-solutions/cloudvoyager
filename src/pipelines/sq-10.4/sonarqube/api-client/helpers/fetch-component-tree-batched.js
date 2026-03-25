// -------- Main Logic --------

const MAX_METRIC_KEYS = 15;

// Fetch component tree in batches of 15 metric keys (SQ 10.4 limit).
export async function fetchComponentTreeBatched(client, projectKey, branch, metricKeys, getPaginatedFn) {
  if (metricKeys.length <= MAX_METRIC_KEYS) {
    const params = { component: projectKey, metricKeys: metricKeys.join(','), qualifiers: 'DIR,FIL', strategy: 'all' };
    if (branch) params.branch = branch;
    return await getPaginatedFn('/api/measures/component_tree', params, 'components');
  }
  const componentMap = new Map();
  for (let i = 0; i < metricKeys.length; i += MAX_METRIC_KEYS) {
    const chunk = metricKeys.slice(i, i + MAX_METRIC_KEYS);
    const params = { component: projectKey, metricKeys: chunk.join(','), qualifiers: 'DIR,FIL', strategy: 'all' };
    if (branch) params.branch = branch;
    const components = await getPaginatedFn('/api/measures/component_tree', params, 'components');
    for (const comp of components) {
      if (componentMap.has(comp.key)) { componentMap.get(comp.key).measures = (componentMap.get(comp.key).measures || []).concat(comp.measures || []); }
      else componentMap.set(comp.key, { ...comp });
    }
  }
  return Array.from(componentMap.values());
}
