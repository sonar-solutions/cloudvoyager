// -------- Check if Issue Belongs to an External Engine --------

export function isExternalIssue(issue, sonarCloudRepos) {
  if (!sonarCloudRepos || sonarCloudRepos.size === 0) return false;
  const repo = issue.rule.split(':')[0];
  return !sonarCloudRepos.has(repo);
}
