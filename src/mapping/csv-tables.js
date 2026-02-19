export function escapeCsv(value) {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

export function toCsvRow(values) {
  return values.map(escapeCsv).join(',');
}

export function generateGroupMappingsCsv(data) {
  const { resourceMappings } = data;
  const rows = [toCsvRow(['Group Name', 'Description', 'Target Organization'])];
  if (resourceMappings?.groupsByOrg) {
    for (const [orgKey, groups] of resourceMappings.groupsByOrg) {
      for (const group of groups) {
        rows.push(toCsvRow([group.name, group.description || '', orgKey]));
      }
    }
  }
  return rows.join('\n') + '\n';
}

export function generateProfileMappingsCsv(data) {
  const { resourceMappings } = data;
  const rows = [toCsvRow(['Profile Name', 'Language', 'Is Default', 'Parent', 'Active Rules', 'Target Organization'])];
  if (resourceMappings?.profilesByOrg) {
    for (const [orgKey, profiles] of resourceMappings.profilesByOrg) {
      for (const profile of profiles) {
        rows.push(toCsvRow([
          profile.name, profile.language, profile.isDefault,
          profile.parentName || '', profile.activeRuleCount || 0, orgKey
        ]));
      }
    }
  }
  return rows.join('\n') + '\n';
}

export function generateGateMappingsCsv(data) {
  const { resourceMappings } = data;
  const rows = [toCsvRow(['Gate Name', 'Is Default', 'Is Built-In', 'Conditions Count', 'Target Organization'])];
  if (resourceMappings?.gatesByOrg) {
    for (const [orgKey, gates] of resourceMappings.gatesByOrg) {
      for (const gate of gates) {
        rows.push(toCsvRow([
          gate.name, gate.isDefault, gate.isBuiltIn,
          gate.conditions?.length || 0, orgKey
        ]));
      }
    }
  }
  return rows.join('\n') + '\n';
}

export function generatePortfolioMappingsCsv(data) {
  const { resourceMappings } = data;
  const rows = [toCsvRow(['Portfolio Key', 'Portfolio Name', 'Projects Count', 'Visibility', 'Target Organization'])];
  if (resourceMappings?.portfoliosByOrg) {
    for (const [orgKey, portfolios] of resourceMappings.portfoliosByOrg) {
      for (const portfolio of portfolios) {
        rows.push(toCsvRow([
          portfolio.key, portfolio.name,
          portfolio.projects?.length || 0, portfolio.visibility || 'public', orgKey
        ]));
      }
    }
  }
  return rows.join('\n') + '\n';
}

export function generateTemplateMappingsCsv(data) {
  const { resourceMappings } = data;
  const rows = [toCsvRow(['Template Name', 'Description', 'Key Pattern', 'Target Organization'])];
  if (resourceMappings?.templatesByOrg) {
    for (const [orgKey, templates] of resourceMappings.templatesByOrg) {
      for (const template of templates) {
        rows.push(toCsvRow([
          template.name, template.description || '',
          template.projectKeyPattern || '', orgKey
        ]));
      }
    }
  }
  return rows.join('\n') + '\n';
}
