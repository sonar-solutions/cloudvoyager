// -------- Build File Component Messages --------

export function buildFileComponents(builder, componentsMap, sourceInfo, sourceKeys, sanitizeLang) {
  builder.data.components.forEach(comp => {
    if (comp.qualifier !== 'FIL' || !sourceKeys.has(comp.key)) return;
    const ref = builder.getComponentRef(comp.key);
    const info = sourceInfo.get(comp.key);
    const lineCount = info.lineCount || Number.parseInt(comp.measures.find(m => m.metric === 'lines')?.value) || 0;
    componentsMap.set(comp.key, {
      ref, type: 4, language: sanitizeLang(comp.language || info.language),
      lines: lineCount, status: 3, projectRelativePath: comp.path || comp.name
    });
  });

  builder.data.sources.forEach(source => {
    if (!source.key || componentsMap.has(source.key)) return;
    const componentName = source.key.split(':').pop() || source.key;
    const lineCount = source.lines ? source.lines.length : 0;
    componentsMap.set(source.key, {
      ref: builder.getComponentRef(source.key), type: 4,
      language: sanitizeLang(source.language), lines: lineCount,
      status: 3, projectRelativePath: componentName
    });
  });
}
