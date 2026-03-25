// -------- Migrate Transfer Schema --------
export const migrateTransferSchema = {
  type: 'object',
  properties: {
    mode: { type: 'string', enum: ['full', 'incremental'], default: 'full', description: 'Transfer mode' },
    batchSize: { type: 'integer', minimum: 1, maximum: 500, default: 100, description: 'Batch size' },
    syncAllBranches: { type: 'boolean', default: true, description: 'Sync all branches of every project (default: true).' },
    excludeBranches: { type: 'array', items: { type: 'string' }, default: [], description: 'Branch names to exclude from sync when syncAllBranches is true' }
  },
  additionalProperties: false
};
