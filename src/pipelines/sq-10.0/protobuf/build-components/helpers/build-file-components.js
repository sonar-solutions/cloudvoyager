// -------- Build File Components --------

export function buildFileComponents(builder, componentsMap, sanitizeLang) {
  const sourceKeys = new Set(builder.data.sources.map(s => s.key));
  const sourceInfo = new Map();
  builder.data.sources.forEach(source => {
    sourceInfo.set(source.key, {
      language: source.language || '',
      lineCount: source.lines ? source.lines.length : 0
    });
  });

  builder.data.components.forEach(comp => {
    if (comp.qualifier !== 'FIL' || !sourceKeys.has(comp.key)) return;

    const ref = builder.getComponentRef(comp.key);
    const info = sourceInfo.get(comp.key);
    const lineCount = info.lineCount || Number.parseInt(comp.measures.find(m => m.metric === 'lines')?.value) || 0;

    componentsMap.set(comp.key, {
      ref,
      type: 4, // ComponentType.FILE
      language: sanitizeLang(comp.language || info.language),
      lines: lineCount,
      status: 3, // FileStatus.ADDED
      projectRelativePath: comp.path || comp.name
    });
  });
}
