// -------- Build Key Conflicts --------

export function buildKeyConflicts(results) {
  const keyWarnings = results.projectKeyWarnings || [];
  if (keyWarnings.length === 0) return [];
  const body = [
    [{ text: 'SonarQube Key', style: 'tableHeader' }, { text: 'SonarCloud Key', style: 'tableHeader' }, { text: 'Taken By', style: 'tableHeader' }],
  ];
  for (const w of keyWarnings) body.push([w.sqKey, w.scKey, w.owner]);
  return [
    { text: 'Project Key Conflicts', style: 'heading' },
    { text: `${keyWarnings.length} project(s) could not use the original SonarQube key because the key is already taken by another organization on SonarCloud.`, style: 'small', margin: [0, 0, 0, 5] },
    { table: { headerRows: 1, widths: ['*', '*', '*'], body }, layout: 'lightHorizontalLines' },
  ];
}
