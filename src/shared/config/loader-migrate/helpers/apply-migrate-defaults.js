// -------- Apply Migrate Defaults --------
export function applyMigrateDefaults(config) {
  if (!config.transfer) config.transfer = { mode: 'full', batchSize: 100 };
  if (!config.migrate) config.migrate = {};
  if (!config.migrate.outputDir) config.migrate.outputDir = './migration-output';
}
