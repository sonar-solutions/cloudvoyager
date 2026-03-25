import logger from '../../../../../shared/utils/logger.js';

// -------- Build QProfiles --------

/** Build qprofilesPerLanguage map from active rules and SonarCloud profiles. */
export function buildQProfiles(inst) {
  const qprofiles = {};
  const scLanguages = new Set(inst.sonarCloudProfiles.map(p => p.language.toLowerCase()));
  const languages = [...new Set([
    ...inst.data.activeRules.map(r => r.language).filter(Boolean),
    ...inst.data.sources.map(s => s.language).filter(Boolean),
  ])];

  languages.forEach(language => {
    const languageKey = language.toLowerCase();
    const scProfile = inst.sonarCloudProfiles.find(p => p.language === languageKey);
    if (scProfile) {
      qprofiles[languageKey] = { key: scProfile.key, name: scProfile.name, language: languageKey, rulesUpdatedAt: new Date(scProfile.rulesUpdatedAt).getTime() };
      logger.debug(`QProfile for ${languageKey}: ${scProfile.key} (${scProfile.name})`);
    } else if (!scLanguages.has(languageKey)) {
      logger.debug(`Skipping unsupported language from qprofiles: ${languageKey}`);
    } else {
      qprofiles[languageKey] = { key: `default-${languageKey}`, name: 'Sonar way', language: languageKey, rulesUpdatedAt: Date.now() };
      logger.warn(`No SonarCloud profile found for language: ${languageKey}, using fallback`);
    }
  });

  return qprofiles;
}
