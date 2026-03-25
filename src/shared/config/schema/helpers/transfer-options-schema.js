// -------- Transfer Options Schema --------
export const transferOptionsSchema = {
  type: 'object',
  properties: {
    mode: { type: 'string', enum: ['full', 'incremental'], default: 'incremental', description: 'Transfer mode: full or incremental' },
    stateFile: { type: 'string', default: './.cloudvoyager-state.json', description: 'Path to state file for incremental transfers' },
    batchSize: { type: 'integer', minimum: 1, maximum: 500, default: 100, description: 'Number of items to process in each batch' },
    syncAllBranches: { type: 'boolean', default: true, description: 'Sync all branches of every project (default: true).' },
    excludeBranches: { type: 'array', items: { type: 'string' }, default: [], description: 'Branch names to exclude from sync when syncAllBranches is true' },
    checkpoint: {
      type: 'object', description: 'Checkpoint and resume settings for incremental migrations',
      properties: {
        enabled: { type: 'boolean', default: true, description: 'Enable checkpoint journal for pause/resume support' },
        cacheExtractions: { type: 'boolean', default: true, description: 'Cache extraction results to disk for faster resume' },
        cacheMaxAgeDays: { type: 'integer', default: 7, minimum: 1, description: 'Maximum age of extraction cache files in days' },
        strictResume: { type: 'boolean', default: false, description: 'Fail on SonarQube version mismatch when resuming (default: warn only)' }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};
