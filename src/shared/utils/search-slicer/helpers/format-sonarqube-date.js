// Formats a millisecond timestamp as a SonarQube-compatible datetime string.
// SonarQube rejects ISO 8601 with milliseconds (e.g. .125Z) — use +0000 instead.
export function formatSonarQubeDate(ts) {
  return new Date(ts).toISOString().replace(/\.\d{3}Z$/, '+0000');
}
