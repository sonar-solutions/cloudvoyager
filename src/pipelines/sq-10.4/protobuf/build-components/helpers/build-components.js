import logger from '../../../../../shared/utils/logger.js';
import { createLanguageSanitizer } from './create-language-sanitizer.js';
import { buildProjectComponent } from './build-project-component.js';
import { buildFileComponents } from './build-file-components.js';

// -------- Main Logic --------

// Build all component protobuf messages (project + files).
export function buildComponents(builder) {
  logger.info('Building component messages...');

  const sanitizeLang = createLanguageSanitizer(builder.sonarCloudProfiles);
  const componentsMap = new Map();

  // Add project root component
  const { key, component } = buildProjectComponent(builder);
  componentsMap.set(key, component);

  // Add file components
  buildFileComponents(builder, componentsMap, sanitizeLang);

  // Track valid component keys
  builder.validComponentKeys = new Set(componentsMap.keys());

  // Link files as children of the project component
  const projectComponent = Array.from(componentsMap.values()).find(c => c.type === 1);
  componentsMap.forEach((comp) => {
    if (comp.type === 4 && projectComponent) projectComponent.childRef.push(comp.ref);
  });

  const components = Array.from(componentsMap.values());
  logger.info(`Built ${components.length} component messages (1 PROJECT + ${components.length - 1} FILES, flat structure)`);
  return components;
}
