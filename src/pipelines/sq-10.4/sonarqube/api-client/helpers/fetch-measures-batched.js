// -------- Main Logic --------

const MAX_METRIC_KEYS = 15;

// Fetch measures in batches of 15 metric keys (SQ 10.4 limit).
export async function fetchMeasuresBatched(client, projectKey, branch, metricKeys) {
  if (metricKeys.length <= MAX_METRIC_KEYS) {
    const params = { component: projectKey, metricKeys: metricKeys.join(',') };
    if (branch) params.branch = branch;
    const response = await client.get('/api/measures/component', { params });
    return response.data.component || {};
  }
  let allMeasures = [];
  for (let i = 0; i < metricKeys.length; i += MAX_METRIC_KEYS) {
    const chunk = metricKeys.slice(i, i + MAX_METRIC_KEYS);
    const params = { component: projectKey, metricKeys: chunk.join(',') };
    if (branch) params.branch = branch;
    const response = await client.get('/api/measures/component', { params });
    allMeasures = allMeasures.concat((response.data.component || {}).measures || []);
  }
  return { key: projectKey, measures: allMeasures };
}
