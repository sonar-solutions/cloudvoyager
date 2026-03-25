// -------- Transfer Config Schema Definition --------
import { performanceSchema, rateLimitSchema } from '../../schema-shared.js';
import { transferSonarqubeSchema } from './transfer-sonarqube-schema.js';
import { transferSonarcloudSchema } from './transfer-sonarcloud-schema.js';
import { transferOptionsSchema } from './transfer-options-schema.js';
import { migrateOptionsSchema } from '../../schema-migrate/helpers/migrate-options-schema.js';

export const configSchema = {
  type: 'object',
  required: ['sonarqube', 'sonarcloud'],
  properties: {
    sonarqube: transferSonarqubeSchema,
    sonarcloud: transferSonarcloudSchema,
    transfer: transferOptionsSchema,
    migrate: migrateOptionsSchema,
    rateLimit: rateLimitSchema,
    performance: performanceSchema
  },
  additionalProperties: false
};
