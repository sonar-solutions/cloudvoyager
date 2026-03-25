import logger from '../../../../../shared/utils/logger.js';

// -------- Process Component Duplications --------

export function processComponentDuplications(data, componentKey, componentRef, builder) {
  const duplications = [];
  const filesMap = data.files || {};

  let currentFileRef = null;
  for (const [ref, fileInfo] of Object.entries(filesMap)) {
    if (fileInfo.key === componentKey) { currentFileRef = ref; break; }
  }

  if (!currentFileRef) {
    logger.debug(`Could not find current file ref for ${componentKey} in duplications response`);
    return [];
  }

  data.duplications.forEach(dup => {
    const blocks = dup.blocks || [];
    if (blocks.length < 2) return;

    const originBlock = blocks.find(b => b._ref === currentFileRef);
    if (!originBlock) return;

    const originPosition = { startLine: originBlock.from, endLine: originBlock.from + originBlock.size - 1 };
    const duplicateEntries = [];

    blocks.forEach(block => {
      if (block === originBlock) return;
      const fileInfo = filesMap[block._ref];
      if (!fileInfo) return;

      let otherFileRef;
      if (block._ref === currentFileRef) { otherFileRef = 0; }
      else {
        const ref = builder.componentRefMap.get(fileInfo.key);
        if (ref === undefined) return;
        otherFileRef = ref;
      }

      duplicateEntries.push({ otherFileRef, range: { startLine: block.from, endLine: block.from + block.size - 1 } });
    });

    if (duplicateEntries.length > 0) duplications.push({ originPosition, duplicate: duplicateEntries });
  });

  return duplications;
}
