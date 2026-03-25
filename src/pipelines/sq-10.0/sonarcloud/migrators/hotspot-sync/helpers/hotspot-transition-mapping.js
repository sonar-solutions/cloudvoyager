// -------- Hotspot Transition Mapping --------

/**
 * Map a hotspot changelog diff entry to a SonarCloud action { status, resolution }.
 */
export function mapHotspotChangelogDiffToAction(diffs) {
  const statusDiff = diffs.find(d => d.key === 'status');
  const resolutionDiff = diffs.find(d => d.key === 'resolution');
  const newStatus = statusDiff?.newValue;
  const newResolution = resolutionDiff?.newValue;

  if (!newStatus) return null;
  if (newStatus === 'TO_REVIEW') return { status: 'TO_REVIEW', resolution: null };
  if (newStatus === 'REVIEWED') return { status: 'REVIEWED', resolution: newResolution || 'SAFE' };
  if (['SAFE', 'ACKNOWLEDGED', 'FIXED'].includes(newStatus)) return { status: 'REVIEWED', resolution: newStatus };
  return null;
}

/**
 * Extract the ordered list of status transitions from a SonarQube hotspot changelog.
 */
export function extractHotspotTransitionsFromChangelog(changelog) {
  const transitions = [];
  for (const entry of changelog) {
    const diffs = entry.diffs || [];
    if (!diffs.some(d => d.key === 'status')) continue;
    const action = mapHotspotChangelogDiffToAction(diffs);
    if (action) transitions.push(action);
  }
  return transitions;
}
