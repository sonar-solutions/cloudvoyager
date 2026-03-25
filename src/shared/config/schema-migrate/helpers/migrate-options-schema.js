// -------- Migrate Options Schema --------
export const migrateOptionsSchema = {
  type: 'object',
  properties: {
    outputDir: { type: 'string', default: './migration-output', description: 'Directory for mapping CSVs and server info output' },
    skipIssueMetadataSync: { type: 'boolean', default: false, description: 'Skip syncing issue metadata (statuses, assignments, comments, tags)' },
    skipHotspotMetadataSync: { type: 'boolean', default: false, description: 'Skip syncing hotspot metadata (statuses, comments)' },
    skipQualityProfileSync: { type: 'boolean', default: false, description: 'Skip syncing quality profiles (projects use default SonarCloud profiles)' },
    dryRun: { type: 'boolean', default: false, description: 'Extract and generate mappings without migrating' }
  },
  additionalProperties: false
};
