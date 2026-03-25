// -------- Map Hotspot Changelog Diff to SonarCloud Action --------

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
