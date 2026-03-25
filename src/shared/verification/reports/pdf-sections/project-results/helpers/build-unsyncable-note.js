// -------- Build Unsyncable Note --------

/**
 * Build the unsyncable note node for a project's PDF section.
 * @param {object} c - Project checks object
 * @returns {object|null} PDF content node or null
 */
export function buildUnsyncableNote(c) {
  const parts = [];
  if (c.issues?.unsyncable?.typeChanges > 0) parts.push(`${c.issues.unsyncable.typeChanges} type changes`);
  if (c.issues?.unsyncable?.severityChanges > 0) parts.push(`${c.issues.unsyncable.severityChanges} severity changes`);
  if (c.hotspots?.unsyncable?.assignments > 0) parts.push(`${c.hotspots.unsyncable.assignments} hotspot assignments`);

  if (parts.length === 0) return null;
  return { text: `Unsyncable: ${parts.join(', ')}`, style: 'statusWarn', margin: [0, 0, 0, 5] };
}
