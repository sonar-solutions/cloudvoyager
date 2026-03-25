import logger from '../../../../../shared/utils/logger.js';

// -------- Source Files Builder --------

export function buildSourceFiles(ctx) {
  logger.info('Building source file messages...');
  const sourceFiles = [];
  ctx.data.sources.forEach(source => {
    if (!ctx.componentRefMap.has(source.key)) return;
    const componentRef = ctx.componentRefMap.get(source.key);
    const lines = source.lines.map((lineContent, index) => ({ line: index + 1, source: lineContent }));
    sourceFiles.push({ componentRef, lines });
  });
  logger.info(`Built ${sourceFiles.length} source file messages`);
  return sourceFiles;
}
