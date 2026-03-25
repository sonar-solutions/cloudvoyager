// -------- Format Timestamp --------

export function formatTimestamp(isoString) {
  if (!isoString) return null;
  return new Date(isoString).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  });
}
