// -------- Estimate Time Remaining --------
export function getEstimatedTimeRemaining(journal) {
  if (!journal || !journal.phases) return null;
  const phases = Object.values(journal.phases);
  const completed = phases.filter(p => p.status === 'completed' && p.startedAt && p.completedAt);
  const remaining = phases.filter(p => p.status !== 'completed');
  if (completed.length === 0 || remaining.length === 0) return null;

  let totalMs = 0;
  for (const phase of completed) {
    totalMs += new Date(phase.completedAt).getTime() - new Date(phase.startedAt).getTime();
  }
  const estimatedMs = (totalMs / completed.length) * remaining.length;

  if (estimatedMs < 60_000) return `~${Math.round(estimatedMs / 1000)}s`;
  if (estimatedMs < 3_600_000) return `~${Math.round(estimatedMs / 60_000)}m`;
  const hours = Math.floor(estimatedMs / 3_600_000);
  const mins = Math.round((estimatedMs % 3_600_000) / 60_000);
  return `~${hours}h ${mins}m`;
}
