// -------- Find Current File Ref --------

/** Find which _ref in the files map corresponds to the given component key. */
export function findCurrentFileRef(filesMap, componentKey) {
  for (const [ref, fileInfo] of Object.entries(filesMap)) {
    if (fileInfo.key === componentKey) return ref;
  }
  return null;
}
