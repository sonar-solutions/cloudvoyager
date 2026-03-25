// -------- Build Fallback Hotspot --------

export function buildFallbackHotspot(hotspot) {
  return {
    key: hotspot.key,
    component: hotspot.component,
    status: hotspot.status,
    resolution: hotspot.resolution || null,
    line: hotspot.line,
    message: hotspot.message,
    assignee: hotspot.assignee || null,
    comments: []
  };
}
