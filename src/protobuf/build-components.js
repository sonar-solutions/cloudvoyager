import logger from '../utils/logger.js';

export function buildComponents(builder) {
  logger.info('Building component messages...');

  const componentsMap = new Map();
  const project = builder.data.project.project;
  componentsMap.set(project.key, {
    ref: builder.getComponentRef(project.key),
    type: 1, // ComponentType.PROJECT
    childRef: [],
    key: builder.sonarCloudConfig.projectKey || project.key
  });

  const sourceKeys = new Set(builder.data.sources.map(s => s.key));
  const sourceInfo = new Map();
  builder.data.sources.forEach(source => {
    sourceInfo.set(source.key, {
      language: source.language || '',
      lineCount: source.lines ? source.lines.length : 0
    });
  });

  builder.data.components.forEach(comp => {
    if (comp.qualifier === 'FIL' && sourceKeys.has(comp.key)) {
      const ref = builder.getComponentRef(comp.key);
      const info = sourceInfo.get(comp.key);
      const lineCount = info.lineCount || Number.parseInt(comp.measures.find(m => m.metric === 'lines')?.value) || 0;
      componentsMap.set(comp.key, {
        ref: ref,
        type: 4, // ComponentType.FILE
        language: comp.language || info.language || '',
        lines: lineCount,
        status: 3, // FileStatus.ADDED
        projectRelativePath: comp.path || comp.name
      });
    }
  });

  builder.data.sources.forEach(source => {
    if (source.key && !componentsMap.has(source.key)) {
      const componentName = source.key.split(':').pop() || source.key;
      const lineCount = source.lines ? source.lines.length : 0;
      componentsMap.set(source.key, {
        ref: builder.getComponentRef(source.key),
        type: 4, // ComponentType.FILE
        language: source.language || '',
        lines: lineCount,
        status: 3, // FileStatus.ADDED
        projectRelativePath: componentName
      });
    }
  });

  builder.validComponentKeys = new Set(componentsMap.keys());

  const projectComponent = Array.from(componentsMap.values()).find(c => c.type === 1);
  componentsMap.forEach((component) => {
    if (component.type === 4 && projectComponent) {
      projectComponent.childRef.push(component.ref);
    }
  });

  const components = Array.from(componentsMap.values());
  logger.info(`Built ${components.length} component messages (1 PROJECT + ${components.length - 1} FILES, flat structure)`);
  return components;
}
