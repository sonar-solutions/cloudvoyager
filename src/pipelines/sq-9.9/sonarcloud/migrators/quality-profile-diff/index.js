import logger from '../../../../../shared/utils/logger.js';
import { diffProfileRules } from './helpers/diff-profile-rules.js';

// -------- Generate Quality Profile Diff Report --------

const MIGRATED_SUFFIX = ' (SonarQube Migrated)';

export async function generateQualityProfileDiff(extractedProfiles, sqClient, scClient) {
  logger.info('Generating quality profile diff report...');

  const scProfiles = await scClient.searchQualityProfiles();
  const scProfilesByName = new Map(scProfiles.map(p => [`${p.language}:${p.name}`, p]));

  const report = {
    generatedAt: new Date().toISOString(),
    summary: { languagesCompared: 0, totalMissingRules: 0, totalAddedRules: 0 },
    languages: {}
  };

  for (const sqProfile of extractedProfiles) {
    const scMigratedKey = `${sqProfile.language}:${sqProfile.name}${MIGRATED_SUFFIX}`;
    const scOriginalKey = `${sqProfile.language}:${sqProfile.name}`;
    const scProfile = scProfilesByName.get(scMigratedKey) || scProfilesByName.get(scOriginalKey);

    if (!scProfile) {
      logger.debug(`No SC profile found for ${sqProfile.name} (${sqProfile.language}), skipping diff`);
      continue;
    }

    try {
      const langDiff = await diffProfileRules(sqProfile, scProfile, sqClient, scClient);
      if (langDiff) {
        const langKey = sqProfile.language;
        const key = report.languages[langKey] ? `${langKey}:${sqProfile.name}` : langKey;
        report.languages[key] = langDiff;
        report.summary.languagesCompared++;
        report.summary.totalMissingRules += langDiff.missingRules.length;
        report.summary.totalAddedRules += langDiff.addedRules.length;
      }
    } catch (error) {
      logger.warn(`Failed to diff profile ${sqProfile.name} (${sqProfile.language}): ${error.message}`);
    }
  }

  logger.info(`Quality profile diff complete: ${report.summary.languagesCompared} languages compared`);
  if (report.summary.totalMissingRules > 0) logger.warn(`${report.summary.totalMissingRules} rules in SonarQube but NOT in SonarCloud`);
  if (report.summary.totalAddedRules > 0) logger.info(`${report.summary.totalAddedRules} rules in SonarCloud but NOT in SonarQube`);

  return report;
}
