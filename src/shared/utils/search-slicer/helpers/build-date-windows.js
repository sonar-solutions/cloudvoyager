// Builds evenly-spaced date windows between two ISO timestamps.
export function buildDateWindows(startDate, endDate, count) {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const step = Math.ceil((end - start) / count);
  const windows = [];

  for (let i = 0; i < count; i++) {
    const windowStart = new Date(start + step * i).toISOString();
    const windowEnd = new Date(
      Math.min(start + step * (i + 1), end)
    ).toISOString();
    windows.push({ start: windowStart, end: windowEnd });
  }

  return windows;
}
