// -------- Main Logic --------

// Extract DevOps binding for a specific project.
export async function extractProjectBinding(client, projectKey) {
  const binding = await client.getProjectBinding(projectKey);
  if (!binding) return null;

  return {
    alm: binding.alm,
    key: binding.key,
    repository: binding.repository || null,
    slug: binding.slug || null,
    url: binding.url || null,
    summaryCommentEnabled: binding.summaryCommentEnabled || false,
    monorepo: binding.monorepo || false
  };
}
