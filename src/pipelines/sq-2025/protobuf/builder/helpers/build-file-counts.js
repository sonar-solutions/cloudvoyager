// -------- Build File Counts --------

/** Build analyzedIndexedFileCountPerType from source data. */
export function buildFileCountsByType(inst) {
  const scLanguages = new Set(inst.sonarCloudProfiles.map(p => p.language.toLowerCase()));
  const counts = {};

  inst.data.sources.forEach(source => {
    const lang = (source.language || 'unknown').toLowerCase();
    if (lang !== 'unknown' && scLanguages.size > 0 && !scLanguages.has(lang)) return;
    counts[lang] = (counts[lang] || 0) + 1;
  });

  return counts;
}

/** Build plugins map (static). */
export function buildPlugins() {
  return { 'javascript': { key: 'javascript', updatedAt: Date.now() } };
}
