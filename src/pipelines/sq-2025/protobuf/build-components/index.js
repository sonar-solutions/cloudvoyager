import { buildProjectComponent } from './helpers/build-project-component.js';
import { buildFileComponents } from './helpers/build-file-components.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Build Components --------

/** Build component protobuf messages from extracted data. */
export function buildComponents(builder) {
  logger.info('Building component messages...');

  const scLanguages = new Set(builder.sonarCloudProfiles.map(p => p.language.toLowerCase()));
  const sanitizeLang = (lang) => {
    if (!lang) return '';
    const key = lang.toLowerCase();
    if (scLanguages.size > 0 && !scLanguages.has(key)) return '';
    return key;
  };

  const componentsMap = new Map();
  const project = builder.data.project.project;
  componentsMap.set(project.key, buildProjectComponent(builder));

  buildFileComponents(builder, componentsMap, sanitizeLang);
  builder.validComponentKeys = new Set(componentsMap.keys());

  const projectComponent = Array.from(componentsMap.values()).find(c => c.type === 1);
  componentsMap.forEach((component) => {
    if (component.type === 4 && projectComponent) projectComponent.childRef.push(component.ref);
  });

  const components = Array.from(componentsMap.values());
  logger.info(`Built ${components.length} component messages (1 PROJECT + ${components.length - 1} FILES, flat structure)`);
  return components;
}
