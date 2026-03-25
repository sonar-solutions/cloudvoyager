import { buildDuplicateEntries } from './build-duplicate-entries.js';

// -------- Main Logic --------

// Process a single duplication group into a Duplication protobuf message.
export function processDuplicationGroup(dup, currentFileRef, filesMap, componentRefMap) {
  const blocks = dup.blocks || [];
  if (blocks.length < 2) return null;

  const originBlock = blocks.find(b => b._ref === currentFileRef);
  if (!originBlock) return null;

  const originPosition = {
    startLine: originBlock.from,
    endLine: originBlock.from + originBlock.size - 1,
  };

  const duplicate = buildDuplicateEntries(blocks, originBlock, currentFileRef, filesMap, componentRefMap);
  if (duplicate.length === 0) return null;

  return { originPosition, duplicate };
}
