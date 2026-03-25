import { findCurrentFileRef } from './find-current-file-ref.js';
import { buildDuplicationEntries } from './build-duplication-entries.js';

// -------- Process Component Duplications --------

/** Process all duplications for a single component. */
export function processComponentDuplications(data, componentRefMap) {
  const filesMap = data.files || {};
  const currentFileRef = findCurrentFileRef(filesMap, data._componentKey);
  if (!currentFileRef) return [];

  const duplications = [];

  for (const dup of data.duplications) {
    const blocks = dup.blocks || [];
    if (blocks.length < 2) continue;

    const originBlock = blocks.find(b => b._ref === currentFileRef);
    if (!originBlock) continue;

    const entries = buildDuplicationEntries(blocks, originBlock, currentFileRef, filesMap, componentRefMap);
    if (entries.length > 0) {
      duplications.push({
        originPosition: { startLine: originBlock.from, endLine: originBlock.from + originBlock.size - 1 },
        duplicate: entries,
      });
    }
  }

  return duplications;
}
