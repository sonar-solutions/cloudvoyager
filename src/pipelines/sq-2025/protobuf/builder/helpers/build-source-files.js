import logger from '../../../../../shared/utils/logger.js';

// -------- Build Source Files --------

/** Build source file messages from extracted source data. */
export function buildSourceFiles(inst) {
  logger.info('Building source file messages...');
  const sourceFiles = [];

  inst.data.sources.forEach(source => {
    if (!inst.componentRefMap.has(source.key)) return;
    const componentRef = inst.componentRefMap.get(source.key);
    const lines = source.lines.map((lineContent, index) => ({ line: index + 1, source: lineContent }));
    sourceFiles.push({ componentRef, lines });
  });

  logger.info(`Built ${sourceFiles.length} source file messages`);
  return sourceFiles;
}
