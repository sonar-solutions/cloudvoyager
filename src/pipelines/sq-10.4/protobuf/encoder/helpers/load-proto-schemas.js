// -------- Main Logic --------

// Load both proto schema files. Uses static-string import() for bundlers.
export async function loadProtoSchemas() {
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
