/**
 * Build the comment text linking back to a source SonarQube issue.
 * Renders as: Link to Original issue (with URL hyperlink) in markdown-aware UIs.
 */
export function buildIssueSourceComment(baseURL, projectKey, issueKey) {
  const url = `${baseURL}/project/issues?id=${encodeURIComponent(projectKey)}&issues=${encodeURIComponent(issueKey)}&open=${encodeURIComponent(issueKey)}`;
  return `Link to [Original issue](${url})`;
}

/**
 * Build the comment text linking back to a source SonarQube hotspot.
 */
export function buildHotspotSourceComment(baseURL, projectKey, hotspotKey) {
  const url = `${baseURL}/security_hotspots?id=${encodeURIComponent(projectKey)}&hotspots=${encodeURIComponent(hotspotKey)}`;
  return `Link to [Original hotspot](${url})`;
}
