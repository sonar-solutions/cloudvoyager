// -------- Build Binding Group Key --------
export function buildBindingGroupKey(binding) {
  const repo = binding.repository || binding.slug || '';

  switch (binding.alm) {
  case 'github': {
    const parts = repo.split('/');
    return parts.length > 1 ? `github:${parts[0]}` : `github:${repo}`;
  }
  case 'gitlab': {
    const parts = repo.split('/');
    return parts.length > 1 ? `gitlab:${parts[0]}` : `gitlab:${repo}`;
  }
  case 'azure':
    return `azure:${binding.repository || binding.slug || 'default'}`;
  case 'bitbucket':
  case 'bitbucketcloud': {
    const parts = (binding.slug || repo).split('/');
    return parts.length > 1 ? `bitbucket:${parts[0]}` : `bitbucket:${binding.slug || repo}`;
  }
  default:
    return `${binding.alm}:${repo}`;
  }
}
