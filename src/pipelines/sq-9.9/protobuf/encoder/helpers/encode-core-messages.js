import logger from '../../../../../shared/utils/logger.js';

// -------- Encode Core Messages (Components, Issues, Measures, Sources) --------

export function encodeCoreMessages(encoder, messages) {
  const components = [];
  logger.debug(`Encoding ${(messages.components || []).length} components...`);
  (messages.components || []).forEach(c => components.push(encoder.encodeComponent(c)));

  const issues = new Map();
  logger.debug(`Encoding issues for ${messages.issuesByComponent.size} components...`);
  messages.issuesByComponent.forEach((iss, ref) => {
    issues.set(ref, Buffer.concat(iss.map(i => encoder.encodeIssueDelimited(i))));
  });

  const measures = new Map();
  logger.debug(`Encoding measures for ${messages.measuresByComponent.size} components...`);
  messages.measuresByComponent.forEach((meas, ref) => {
    measures.set(ref, Buffer.concat(meas.map(m => encoder.encodeMeasureDelimited(m))));
  });

  logger.debug(`Preparing ${(messages.sourceFiles || []).length} source files as plain text...`);
  const sourceFilesText = (messages.sourceFiles || []).map(sf => ({
    componentRef: sf.componentRef,
    text: sf.lines.map(l => l.source).join('\n'),
  }));

  return { components, issues, measures, sourceFilesText };
}
