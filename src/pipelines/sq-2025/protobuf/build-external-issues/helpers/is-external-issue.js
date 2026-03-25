// -------- Is External Issue --------

/** Check if an issue belongs to an engine not available in SonarCloud. */
export function isExternalIssue(issue, sonarCloudRepos) {
  if (!sonarCloudRepos || sonarCloudRepos.size === 0) return false;
  const repo = issue.rule.split(':')[0];
  return !sonarCloudRepos.has(repo);
}
