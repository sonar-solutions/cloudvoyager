// -------- Find Files With Duplications --------

/** Filter FILE components that have duplicated_blocks > 0. */
export function findFilesWithDuplications(components) {
  return components.filter(c => {
    if (c.qualifier !== 'FIL') return false;
    const dupBlocks = (c.measures || []).find(m => m.metric === 'duplicated_blocks');
    return dupBlocks && parseInt(dupBlocks.value, 10) > 0;
  });
}
