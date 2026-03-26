import protobuf from 'protobufjs';
import logger from '../../../../../shared/utils/logger.js';
import { ProtobufEncodingError } from '../../../../../shared/utils/errors.js';

// -------- Load Protobuf Schemas --------

async function loadProtoTexts() {
  try {
    const [constantsMod, scannerReportMod] = await Promise.all([
      import('../../schema/constants.proto'),
      import('../../schema/scanner-report.proto'),
    ]);
    return [constantsMod.default, scannerReportMod.default];
  } catch {
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const dir = dirname(fileURLToPath(import.meta.url));
    const schemaDir = join(dir, '..', '..', 'schema');
    return [
      readFileSync(join(schemaDir, 'constants.proto'), 'utf-8'),
      readFileSync(join(schemaDir, 'scanner-report.proto'), 'utf-8'),
    ];
  }
}

export async function loadSchemas() {
  logger.info('Loading protobuf schemas...');
  try {
    const [constantsText, scannerReportText] = await loadProtoTexts();
    const root = new protobuf.Root();
    protobuf.parse(constantsText, root);
    const stripped = scannerReportText.replace(/^import\s+"constants\.proto";\s*$/m, '');
    protobuf.parse(stripped, root);
    logger.info('Protobuf schemas loaded successfully');
    return root;
  } catch (error) {
    throw new ProtobufEncodingError(`Failed to load protobuf schemas: ${error.message}`);
  }
}
