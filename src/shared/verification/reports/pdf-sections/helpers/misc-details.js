// -------- PDF Branch, Settings, Permission Details --------

import { h, truncate, smallTable } from './pdf-table-utils.js';

export function buildBranchDetails(c, nodes) {
  if (!c.branches?.missing?.length) return;
  nodes.push({ text: `Missing Branches (${c.branches.missing.length})`, style: 'subheading' });
  const branchList = c.branches.missing.map(b => ({ text: `• ${b}`, fontSize: 8 }));
  nodes.push({ ul: branchList, margin: [0, 0, 0, 5] });
}

export function buildSettingsDetails(c, nodes) {
  if (c.settings?.mismatches?.length > 0) {
    nodes.push({ text: `Settings Mismatches (${c.settings.mismatches.length})`, style: 'subheading' });
    const rows = [[h('Key'), h('SQ Value'), h('SC Value')]];
    for (const m of c.settings.mismatches) {
      rows.push([m.key, truncate(String(m.sqValue ?? 'N/A'), 40), truncate(String(m.scValue ?? 'N/A'), 40)]);
    }
    nodes.push(smallTable(rows, ['*', 120, 120]));
  }

  if (c.settings?.sqOnly?.length > 0) {
    nodes.push({ text: `Settings Only in SonarQube (${c.settings.sqOnly.length})`, style: 'subheading' });
    const rows = [[h('Key'), h('Value')]];
    for (const s of c.settings.sqOnly) {
      rows.push([s.key, truncate(String(s.value), 50)]);
    }
    nodes.push(smallTable(rows, ['*', 150]));
  }
}

export function buildPermissionDetails(c, nodes) {
  if (!c.permissions?.mismatches?.length) return;
  nodes.push({ text: `Permission Mismatches (${c.permissions.mismatches.length} groups)`, style: 'subheading' });
  const rows = [[h('Group'), h('Missing Permissions')]];
  for (const m of c.permissions.mismatches) {
    rows.push([m.group || m.groupName, (m.missingPermissions || []).join(', ')]);
  }
  nodes.push(smallTable(rows, [120, '*']));
}
