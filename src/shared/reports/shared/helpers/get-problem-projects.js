// -------- Get Problem Projects --------

export function getProblemProjects(results) {
  return results.projects.filter(p => p.status !== 'success');
}
