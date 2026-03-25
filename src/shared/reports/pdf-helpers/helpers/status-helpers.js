// -------- Status Helpers --------

export function statusStyle(status) {
  if (status === 'success') return 'statusOk';
  if (status === 'failed') return 'statusFail';
  if (status === 'partial') return 'statusPartial';
  if (status === 'skipped') return 'statusSkip';
  return 'tableCell';
}

export function statusText(status) {
  if (status === 'success') return 'OK';
  if (status === 'failed') return 'FAIL';
  if (status === 'skipped') return 'SKIP';
  if (status === 'partial') return 'PARTIAL';
  return status || '';
}
