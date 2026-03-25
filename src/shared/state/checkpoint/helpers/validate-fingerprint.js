// -------- Fingerprint Validation --------

import logger from '../../../utils/logger.js';
import { StaleResumeError } from '../../../utils/errors.js';

/**
 * Validate that the current session matches the stored journal fingerprint.
 * @param {object} stored - Stored session fingerprint
 * @param {object} current - Current session fingerprint
 * @param {string} cloudvoyagerVersion - Stored cloudvoyager version
 */
export function validateFingerprint(stored, current, cloudvoyagerVersion) {
  if (!stored) return;

  const warnings = [];

  if (current.sonarQubeVersion && stored.sonarQubeVersion &&
      current.sonarQubeVersion !== stored.sonarQubeVersion) {
    warnings.push(
      `SonarQube version changed: ${stored.sonarQubeVersion} → ${current.sonarQubeVersion}`
    );
  }

  if (current.sonarQubeUrl && stored.sonarQubeUrl &&
      current.sonarQubeUrl !== stored.sonarQubeUrl) {
    warnings.push(
      `SonarQube URL changed: ${stored.sonarQubeUrl} → ${current.sonarQubeUrl}`
    );
  }

  if (current.projectKey && stored.projectKey &&
      current.projectKey !== stored.projectKey) {
    throw new StaleResumeError(
      `Project key mismatch: journal has '${stored.projectKey}' but config has '${current.projectKey}'. ` +
      'Use --force-restart to discard the journal and start fresh.'
    );
  }

  if (current.cloudvoyagerVersion && cloudvoyagerVersion &&
      current.cloudvoyagerVersion !== cloudvoyagerVersion) {
    warnings.push(
      `CloudVoyager version changed: ${cloudvoyagerVersion} → ${current.cloudvoyagerVersion}`
    );
  }

  for (const w of warnings) {
    logger.warn(`Resume warning: ${w}`);
  }
}
