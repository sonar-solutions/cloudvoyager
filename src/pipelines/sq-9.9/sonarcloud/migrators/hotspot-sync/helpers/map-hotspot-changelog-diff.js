// -------- Map Hotspot Changelog Diff to SonarCloud Action --------

/** Map SQ resolution to SC-compatible resolution. SC only accepts SAFE or FIXED. */
function toScResolution(resolution) {
  if (resolution === 'ACKNOWLEDGED') return 'SAFE';
  if (resolution === 'FIXED') return 'FIXED';
  if (resolution === 'SAFE') return 'SAFE';
  return null;
}

export function mapHotspotChangelogDiffToAction(diffs) {
  const statusDiff = diffs.find(d => d.key === 'status');
  const resolutionDiff = diffs.find(d => d.key === 'resolution');
  const newStatus = statusDiff?.newValue;
  const newResolution = resolutionDiff?.newValue;

  if (!newStatus) return null;
  if (newStatus === 'TO_REVIEW') return { status: 'TO_REVIEW', resolution: null };
  if (newStatus === 'REVIEWED') return { status: 'REVIEWED', resolution: toScResolution(newResolution) || 'SAFE' };
  if (['SAFE', 'ACKNOWLEDGED', 'FIXED'].includes(newStatus)) return { status: 'REVIEWED', resolution: toScResolution(newStatus) };
  return null;
}
