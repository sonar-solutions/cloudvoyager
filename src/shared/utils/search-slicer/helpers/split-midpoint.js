import { formatSonarQubeDate } from './format-sonarqube-date.js';

// Returns the SonarQube-compatible datetime at the midpoint between two date strings.
export function splitMidpoint(startIso, endIso) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return formatSonarQubeDate(start + Math.floor((end - start) / 2));
}
