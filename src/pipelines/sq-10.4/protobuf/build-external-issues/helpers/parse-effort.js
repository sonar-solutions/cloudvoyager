// -------- Main Logic --------

// Parse a SonarQube effort string (e.g. "30min", "2h", "1h30min") to minutes.
export function parseEffortToMinutes(effort) {
  if (!effort) return 0;
  if (typeof effort === 'number') return effort;

  let minutes = 0;
  const hourMatch = effort.match(/(\d+)h/);
  const minMatch = effort.match(/(\d+)min/);
  if (hourMatch) minutes += Number.parseInt(hourMatch[1], 10) * 60;
  if (minMatch) minutes += Number.parseInt(minMatch[1], 10);
  return minutes;
}
