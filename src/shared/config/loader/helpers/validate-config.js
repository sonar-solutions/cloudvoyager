// -------- Validate Config --------
import { ValidationError } from '../../../utils/errors.js';
import { validate } from './create-validator.js';

export function validateConfig(config) {
  const valid = validate(config);
  if (!valid) {
    const errors = validate.errors.map(err => `${err.instancePath} ${err.message}`);
    throw new ValidationError('Configuration validation failed', errors);
  }
  return true;
}
