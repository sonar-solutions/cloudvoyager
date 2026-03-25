// -------- Build Duplicate Entries from a Duplication Block --------

export function buildDuplicateEntries(blocks, originBlock, currentFileRef, filesMap, componentRefMap) {
  const entries = [];

  blocks.forEach(block => {
    if (block === originBlock) return;
    const fileInfo = filesMap[block._ref];
    if (!fileInfo) return;

    let otherFileRef;
    if (block._ref === currentFileRef) {
      otherFileRef = 0;
    } else {
      const ref = componentRefMap.get(fileInfo.key);
      if (ref === undefined) return;
      otherFileRef = ref;
    }

    entries.push({
      otherFileRef,
      range: { startLine: block.from, endLine: block.from + block.size - 1 },
    });
  });

  return entries;
}
