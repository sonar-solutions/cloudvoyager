// -------- File Count Builder --------

export function buildFileCountsByType(ctx) {
  const scLanguages = new Set(ctx.sonarCloudProfiles.map(p => p.language.toLowerCase()));
  const counts = {};
  ctx.data.sources.forEach(source => {
    const lang = (source.language || 'unknown').toLowerCase();
    if (lang !== 'unknown' && scLanguages.size > 0 && !scLanguages.has(lang)) return;
    counts[lang] = (counts[lang] || 0) + 1;
  });
  return counts;
}
