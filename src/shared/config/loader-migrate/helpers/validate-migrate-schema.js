// -------- Validate Migrate Schema --------
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { migrateConfigSchema } from '../../schema.js';
import { ValidationError } from '../../../utils/errors.js';

const ajv = new Ajv({ allErrors: true, useDefaults: true });
addFormats(ajv);

export function validateMigrateSchema(config) {
  const migrateValidate = ajv.compile(migrateConfigSchema);
  const valid = migrateValidate(config);
  if (!valid) {
    const errors = migrateValidate.errors.map(err => `${err.instancePath} ${err.message}`);
    throw new ValidationError('Migration configuration validation failed', errors);
  }
}
