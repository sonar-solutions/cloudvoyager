// -------- Create Schema Validator --------
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { configSchema } from '../../schema.js';

const ajv = new Ajv({ allErrors: true, useDefaults: true });
addFormats(ajv);
export const validate = ajv.compile(configSchema);
