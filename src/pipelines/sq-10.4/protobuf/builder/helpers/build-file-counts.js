// -------- Main Logic --------

// Build analyzed file count by language type.
export function buildFileCountsByType(instance) {
  const scLanguages = new Set(instance.sonarCloudProfiles.map(p => p.language.toLowerCase()));
  const counts = {};
  instance.data.sources.forEach(source => {
    const lang = (source.language || 'unknown').toLowerCase();
    if (lang !== 'unknown' && scLanguages.size > 0 && !scLanguages.has(lang)) return;
    counts[lang] = (counts[lang] || 0) + 1;
  });
  return counts;
}
