import { formatSonarQubeDate } from './format-sonarqube-date.js';

// Builds evenly-spaced date windows between two timestamps.
// Dates are formatted for SonarQube's API (no milliseconds, +0000 timezone).
export function buildDateWindows(startDate, endDate, count) {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const step = Math.ceil((end - start) / count);
  const windows = [];

  for (let i = 0; i < count; i++) {
    const windowStart = formatSonarQubeDate(start + step * i);
    const windowEnd = formatSonarQubeDate(Math.min(start + step * (i + 1), end));
    windows.push({ start: windowStart, end: windowEnd });
  }

  return windows;
}
