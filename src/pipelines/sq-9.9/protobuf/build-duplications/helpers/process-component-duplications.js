import { findCurrentFileRef } from './find-current-file-ref.js';
import { buildDuplicateEntries } from './build-duplicate-entries.js';

// -------- Process Duplications for a Single Component --------

export function processComponentDuplications(data, componentKey, componentRefMap) {
  const filesMap = data.files || {};
  const currentFileRef = findCurrentFileRef(filesMap, componentKey);
  if (!currentFileRef) return [];

  const duplications = [];
  data.duplications.forEach(dup => {
    const blocks = dup.blocks || [];
    if (blocks.length < 2) return;

    const originBlock = blocks.find(b => b._ref === currentFileRef);
    if (!originBlock) return;

    const originPosition = { startLine: originBlock.from, endLine: originBlock.from + originBlock.size - 1 };
    const entries = buildDuplicateEntries(blocks, originBlock, currentFileRef, filesMap, componentRefMap);
    if (entries.length > 0) duplications.push({ originPosition, duplicate: entries });
  });

  return duplications;
}
