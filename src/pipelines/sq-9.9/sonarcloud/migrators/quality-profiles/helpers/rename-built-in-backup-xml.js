// -------- Rename Built-In Profile Backup XML --------

const MIGRATED_SUFFIX = ' (SonarQube Migrated)';

export function renameBuiltInBackupXml(backupXml, originalName) {
  const migratedName = originalName + MIGRATED_SUFFIX;
  return backupXml.replace(
    `<name>${originalName}</name>`,
    `<name>${migratedName}</name>`
  );
}

export { MIGRATED_SUFFIX };
