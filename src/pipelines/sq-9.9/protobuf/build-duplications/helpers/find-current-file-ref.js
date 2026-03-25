// -------- Find Current File Reference in Duplications Response --------

export function findCurrentFileRef(filesMap, componentKey) {
  for (const [ref, fileInfo] of Object.entries(filesMap)) {
    if (fileInfo.key === componentKey) return ref;
  }
  return null;
}
