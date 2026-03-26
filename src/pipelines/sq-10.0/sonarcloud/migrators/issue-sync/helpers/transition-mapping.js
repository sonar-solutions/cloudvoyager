// -------- Issue Transition Mapping --------

export function mapChangelogDiffToTransition(diffs) {
  const statusDiff = diffs.find(d => d.key === 'status');
  const resolutionDiff = diffs.find(d => d.key === 'resolution');
  const newStatus = statusDiff?.newValue;
  const newResolution = resolutionDiff?.newValue;
  if (!newStatus) return null;
  if (newResolution === 'FALSE-POSITIVE' || newStatus === 'FALSE-POSITIVE') return 'falsepositive';
  if (newResolution === 'WONTFIX' || newStatus === 'WONTFIX') return 'wontfix';
  switch (newStatus) {
    case 'CONFIRMED': return 'confirm';
    case 'REOPENED': return 'reopen';
    case 'OPEN': return 'unconfirm';
    case 'RESOLVED': return 'resolve';
    case 'CLOSED': return 'resolve';
    case 'ACCEPTED': return 'wontfix';
    default: return null;
  }
}

export function extractTransitionsFromChangelog(changelog) {
  const transitions = [];
  for (const entry of changelog) {
    const diffs = entry.diffs || [];
    if (!diffs.some(d => d.key === 'status')) continue;
    const transition = mapChangelogDiffToTransition(diffs);
    if (transition) transitions.push(transition);
  }
  return transitions;
}

export function getFallbackTransition(sqIssue) {
  if (sqIssue.resolution === 'FALSE-POSITIVE' || sqIssue.status === 'FALSE-POSITIVE') return 'falsepositive';
  if (sqIssue.resolution === 'WONTFIX' || sqIssue.status === 'WONTFIX') return 'wontfix';
  switch (sqIssue.status) {
    case 'CONFIRMED': return 'confirm';
    case 'RESOLVED': case 'CLOSED': return 'resolve';
    case 'ACCEPTED': return 'wontfix';
    case 'REOPENED': return 'reopen';
    default: return null;
  }
}
