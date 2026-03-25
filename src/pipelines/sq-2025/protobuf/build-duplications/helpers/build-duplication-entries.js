// -------- Build Duplication Entries --------

/** Build duplicate entries from a single duplication group. */
export function buildDuplicationEntries(blocks, originBlock, currentFileRef, filesMap, componentRefMap) {
  const entries = [];

  for (const block of blocks) {
    if (block === originBlock) continue;

    const fileInfo = filesMap[block._ref];
    if (!fileInfo) continue;

    let otherFileRef;
    if (block._ref === currentFileRef) {
      otherFileRef = 0;
    } else {
      const ref = componentRefMap.get(fileInfo.key);
      if (ref === undefined) continue;
      otherFileRef = ref;
    }

    entries.push({
      otherFileRef,
      range: { startLine: block.from, endLine: block.from + block.size - 1 },
    });
  }

  return entries;
}
