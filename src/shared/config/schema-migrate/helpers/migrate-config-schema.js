// -------- Migrate Config Schema Definition --------
import { rateLimitSchema } from '../../schema-shared.js';
import { performanceSchema } from '../../schema-shared.js';
import { migrateSonarqubeSchema } from './migrate-sonarqube-schema.js';
import { migrateSonarcloudSchema } from './migrate-sonarcloud-schema.js';
import { migrateTransferSchema } from './migrate-transfer-schema.js';
import { migrateOptionsSchema } from './migrate-options-schema.js';

export const migrateConfigSchema = {
  type: 'object',
  required: ['sonarqube', 'sonarcloud'],
  properties: {
    sonarqube: migrateSonarqubeSchema,
    sonarcloud: migrateSonarcloudSchema,
    transfer: migrateTransferSchema,
    migrate: migrateOptionsSchema,
    rateLimit: rateLimitSchema,
    performance: performanceSchema
  },
  additionalProperties: false
};
