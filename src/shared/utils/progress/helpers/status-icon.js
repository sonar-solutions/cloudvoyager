// -------- Status Icon --------
export function statusIcon(status) {
  if (status === 'completed') return '[done]';
  if (status === 'in_progress') return '[>>  ]';
  if (status === 'failed') return '[FAIL]';
  return '[    ]';
}
