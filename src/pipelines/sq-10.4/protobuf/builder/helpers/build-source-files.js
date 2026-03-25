import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Build source file messages from extracted source data.
export function buildSourceFiles(instance) {
  logger.info('Building source file messages...');
  const sourceFiles = [];
  instance.data.sources.forEach(source => {
    if (!instance.componentRefMap.has(source.key)) return;
    const componentRef = instance.componentRefMap.get(source.key);
    const lines = source.lines.map((lineContent, index) => ({ line: index + 1, source: lineContent }));
    sourceFiles.push({ componentRef, lines });
  });
  logger.info(`Built ${sourceFiles.length} source file messages`);
  return sourceFiles;
}
