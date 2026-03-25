// -------- Status Icon --------

export function statusIcon(status) {
  if (status === 'success') return 'OK';
  if (status === 'failed') return 'FAIL';
  if (status === 'skipped') return 'SKIP';
  return status;
}
