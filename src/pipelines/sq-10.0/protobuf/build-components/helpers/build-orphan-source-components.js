// -------- Build Orphan Source Components --------

export function buildOrphanSourceComponents(builder, componentsMap, sanitizeLang) {
  builder.data.sources.forEach(source => {
    if (!source.key || componentsMap.has(source.key)) return;

    const componentName = source.key.split(':').pop() || source.key;
    const lineCount = source.lines ? source.lines.length : 0;

    componentsMap.set(source.key, {
      ref: builder.getComponentRef(source.key),
      type: 4, // ComponentType.FILE
      language: sanitizeLang(source.language),
      lines: lineCount,
      status: 3, // FileStatus.ADDED
      projectRelativePath: componentName
    });
  });
}
