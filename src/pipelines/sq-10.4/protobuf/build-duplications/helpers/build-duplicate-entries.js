// -------- Main Logic --------

// Build duplicate entries for a single duplication group.
export function buildDuplicateEntries(blocks, originBlock, currentFileRef, filesMap, componentRefMap) {
  const entries = [];

  for (const block of blocks) {
    if (block === originBlock) continue;

    const fileInfo = filesMap[block._ref];
    if (!fileInfo) continue;

    let otherFileRef;
    if (block._ref === currentFileRef) {
      otherFileRef = 0; // Same-file duplication
    } else {
      const ref = componentRefMap.get(fileInfo.key);
      if (ref === undefined) continue; // File not in our component map
      otherFileRef = ref;
    }

    entries.push({
      otherFileRef,
      range: { startLine: block.from, endLine: block.from + block.size - 1 },
    });
  }

  return entries;
}
