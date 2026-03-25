import logger from '../../../../../shared/utils/logger.js';
import { findCurrentFileRef } from './find-current-file-ref.js';
import { processDuplicationGroup } from './process-duplication-group.js';

// -------- Main Logic --------

// Process all duplication groups for a single component.
export function processComponentDuplications(componentKey, data, componentRefMap) {
  const componentRef = componentRefMap.get(componentKey);
  if (!componentRef) return null;

  const filesMap = data.files || {};
  const currentFileRef = findCurrentFileRef(filesMap, componentKey);

  if (!currentFileRef) {
    logger.debug(`Could not find current file ref for ${componentKey} in duplications response`);
    return null;
  }

  const duplications = [];
  for (const dup of data.duplications) {
    const result = processDuplicationGroup(dup, currentFileRef, filesMap, componentRefMap);
    if (result) duplications.push(result);
  }

  if (duplications.length === 0) return null;
  return { componentRef, duplications };
}
