// -------- Main Logic --------

// Find the files-map ref key that corresponds to the current component.
export function findCurrentFileRef(filesMap, componentKey) {
  for (const [ref, fileInfo] of Object.entries(filesMap)) {
    if (fileInfo.key === componentKey) return ref;
  }
  return null;
}
