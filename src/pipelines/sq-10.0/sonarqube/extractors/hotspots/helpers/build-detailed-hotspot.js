// -------- Build Detailed Hotspot --------

export function buildDetailedHotspot(hotspot, details) {
  return {
    key: hotspot.key,
    component: hotspot.component,
    project: hotspot.project,
    securityCategory: hotspot.securityCategory,
    vulnerabilityProbability: hotspot.vulnerabilityProbability,
    status: hotspot.status,
    resolution: hotspot.resolution || null,
    line: hotspot.line,
    message: hotspot.message,
    assignee: hotspot.assignee || null,
    author: hotspot.author || null,
    creationDate: hotspot.creationDate,
    updateDate: hotspot.updateDate,
    rule: details.rule || {},
    comments: details.comment || [],
    changelog: details.changelog || []
  };
}
