// -------- Main Logic --------

/**
 * Map a hotspot changelog diff entry to a SonarCloud action { status, resolution }.
 * Returns null if no actionable status change is found.
 */
export function mapHotspotChangelogDiffToAction(diffs) {
  const statusDiff = diffs.find(d => d.key === 'status');
  const newStatus = statusDiff?.newValue;
  if (!newStatus) return null;

  // Reopened
  if (newStatus === 'TO_REVIEW') return { status: 'TO_REVIEW', resolution: null };

  // Reviewed with explicit resolution
  if (newStatus === 'REVIEWED') {
    const newResolution = diffs.find(d => d.key === 'resolution')?.newValue;
    return { status: 'REVIEWED', resolution: newResolution || 'SAFE' };
  }

  // In newer SQ versions, status can be SAFE/ACKNOWLEDGED/FIXED directly
  if (['SAFE', 'ACKNOWLEDGED', 'FIXED'].includes(newStatus)) {
    return { status: 'REVIEWED', resolution: newStatus };
  }

  return null;
}
