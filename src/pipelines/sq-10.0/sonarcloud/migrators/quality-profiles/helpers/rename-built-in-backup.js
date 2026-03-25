// -------- Rename Built-In Backup --------

const MIGRATED_SUFFIX = ' (SonarQube Migrated)';

/**
 * Rename a built-in profile's backup XML so it restores as a custom profile.
 */
export function renameBuiltInBackupXml(backupXml, originalName) {
  const migratedName = originalName + MIGRATED_SUFFIX;
  return backupXml.replace(`<name>${originalName}</name>`, `<name>${migratedName}</name>`);
}

export { MIGRATED_SUFFIX };
