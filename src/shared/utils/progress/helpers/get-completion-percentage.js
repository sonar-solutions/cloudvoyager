// -------- Get Completion Percentage --------
export function getCompletionPercentage(journal) {
  if (!journal || !journal.phases) return 0;
  const phases = Object.values(journal.phases);
  if (phases.length === 0) return 0;
  const completed = phases.filter(p => p.status === 'completed').length;
  return Math.round((completed / phases.length) * 100);
}
