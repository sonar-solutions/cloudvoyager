// -------- Create Sanitize Lang --------

export function createSanitizeLang(sonarCloudProfiles) {
  const scLanguages = new Set(sonarCloudProfiles.map(p => p.language.toLowerCase()));

  return (lang) => {
    if (!lang) return '';
    const key = lang.toLowerCase();
    if (scLanguages.size > 0 && !scLanguages.has(key)) return '';
    return key;
  };
}
