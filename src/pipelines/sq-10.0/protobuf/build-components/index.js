// -------- Build Components --------

import logger from '../../../../shared/utils/logger.js';
import { createSanitizeLang } from './helpers/create-sanitize-lang.js';
import { buildProjectComponent } from './helpers/build-project-component.js';
import { buildFileComponents } from './helpers/build-file-components.js';
import { buildOrphanSourceComponents } from './helpers/build-orphan-source-components.js';
import { linkChildRefs } from './helpers/link-child-refs.js';

export function buildComponents(builder) {
  logger.info('Building component messages...');

  const sanitizeLang = createSanitizeLang(builder.sonarCloudProfiles);
  const componentsMap = new Map();

  buildProjectComponent(builder, componentsMap);
  buildFileComponents(builder, componentsMap, sanitizeLang);
  buildOrphanSourceComponents(builder, componentsMap, sanitizeLang);

  builder.validComponentKeys = new Set(componentsMap.keys());
  linkChildRefs(componentsMap);

  const components = Array.from(componentsMap.values());
  logger.info(`Built ${components.length} component messages (1 PROJECT + ${components.length - 1} FILES, flat structure)`);
  return components;
}
