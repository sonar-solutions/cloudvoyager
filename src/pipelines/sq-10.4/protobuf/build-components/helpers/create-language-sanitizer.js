// -------- Main Logic --------

// Create a language sanitizer that strips unsupported plugin languages.
export function createLanguageSanitizer(sonarCloudProfiles) {
  const scLanguages = new Set(sonarCloudProfiles.map(p => p.language.toLowerCase()));

  return (lang) => {
    if (!lang) return '';
    const key = lang.toLowerCase();
    if (scLanguages.size > 0 && !scLanguages.has(key)) return '';
    return key;
  };
}
