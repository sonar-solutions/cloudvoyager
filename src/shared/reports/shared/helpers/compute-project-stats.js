// -------- Compute Project Stats --------

export function computeProjectStats(results) {
  const succeeded = results.projects.filter(p => p.status === 'success').length;
  const partial = results.projects.filter(p => p.status === 'partial').length;
  const failed = results.projects.filter(p => p.status === 'failed').length;
  const total = results.projects.length;
  return { succeeded, partial, failed, total };
}
