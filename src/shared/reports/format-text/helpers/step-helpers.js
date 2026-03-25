// -------- Step Formatting Helpers --------

export function getStepIcon(status) {
  if (status === 'success') return 'OK  ';
  if (status === 'skipped') return 'SKIP';
  return 'FAIL';
}

export function formatStepLine(lines, step) {
  const icon = getStepIcon(step.status);
  const detail = step.detail ? ` (${step.detail})` : '';
  lines.push(`  [${icon}] ${step.step}${detail}`);
  if (step.error) lines.push(`         ${step.error}`);
}

export function getProjectStatusIcon(status) {
  if (status === 'success') return 'OK     ';
  if (status === 'partial') return 'PARTIAL';
  return 'FAIL   ';
}
