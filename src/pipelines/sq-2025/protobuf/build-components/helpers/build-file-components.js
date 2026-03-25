// -------- Build File Components --------

/** Build file components from extracted data. */
export function buildFileComponents(builder, componentsMap, sanitizeLang) {
  const sourceKeys = new Set(builder.data.sources.map(s => s.key));
  const sourceInfo = new Map();
  builder.data.sources.forEach(source => {
    sourceInfo.set(source.key, { language: source.language || '', lineCount: source.lines ? source.lines.length : 0 });
  });

  builder.data.components.forEach(comp => {
    if (comp.qualifier === 'FIL' && sourceKeys.has(comp.key)) {
      const ref = builder.getComponentRef(comp.key);
      const info = sourceInfo.get(comp.key);
      const lineCount = info.lineCount || Number.parseInt(comp.measures.find(m => m.metric === 'lines')?.value) || 0;
      componentsMap.set(comp.key, {
        ref, type: 4, language: sanitizeLang(comp.language || info.language),
        lines: lineCount, status: 3, projectRelativePath: comp.path || comp.name,
      });
    }
  });

  builder.data.sources.forEach(source => {
    if (source.key && !componentsMap.has(source.key)) {
      const componentName = source.key.split(':').pop() || source.key;
      componentsMap.set(source.key, {
        ref: builder.getComponentRef(source.key), type: 4,
        language: sanitizeLang(source.language),
        lines: source.lines ? source.lines.length : 0,
        status: 3, projectRelativePath: componentName,
      });
    }
  });
}
