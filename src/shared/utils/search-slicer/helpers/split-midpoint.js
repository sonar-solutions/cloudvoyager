// Returns the ISO timestamp at the midpoint between two ISO date strings.
export function splitMidpoint(startIso, endIso) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return new Date(start + Math.floor((end - start) / 2)).toISOString();
}
