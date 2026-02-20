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
  const rows = [toCsvRow(['Include', 'Group Name', 'Description', 'Members Count', 'Is Default', 'Target Organization'])];
  if (resourceMappings?.groupsByOrg) {
    for (const [orgKey, groups] of resourceMappings.groupsByOrg) {
      for (const group of groups) {
        rows.push(toCsvRow(['yes', group.name, group.description || '', group.membersCount || 0, group.default || false, orgKey]));
      }
    }
  }
  return rows.join('\n') + '\n';
}

export function generateProfileMappingsCsv(data) {
  const { resourceMappings } = data;
  const rows = [toCsvRow(['Include', 'Profile Name', 'Language', 'Is Default', 'Is Built-In', 'Parent', 'Active Rules', 'Target Organization'])];
  if (resourceMappings?.profilesByOrg) {
    for (const [orgKey, profiles] of resourceMappings.profilesByOrg) {
      for (const profile of profiles) {
        rows.push(toCsvRow([
          'yes', profile.name, profile.language, profile.isDefault,
          profile.isBuiltIn, profile.parentName || '', profile.activeRuleCount || 0, orgKey
        ]));
      }
    }
  }
  return rows.join('\n') + '\n';
}

export function generateGateMappingsCsv(data) {
  const { resourceMappings } = data;
  const rows = [toCsvRow(['Include', 'Gate Name', 'Is Default', 'Is Built-In', 'Condition Metric', 'Condition Operator', 'Condition Threshold', 'Target Organization'])];
  if (resourceMappings?.gatesByOrg) {
    for (const [orgKey, gates] of resourceMappings.gatesByOrg) {
      for (const gate of gates) {
        // Gate header row (empty condition fields)
        rows.push(toCsvRow(['yes', gate.name, gate.isDefault, gate.isBuiltIn, '', '', '', orgKey]));
        // One row per condition
        if (gate.conditions) {
          for (const condition of gate.conditions) {
            rows.push(toCsvRow(['yes', gate.name, '', '', condition.metric, condition.op, condition.error, orgKey]));
          }
        }
      }
    }
  }
  return rows.join('\n') + '\n';
}

export function generatePortfolioMappingsCsv(data) {
  const { resourceMappings } = data;
  const rows = [toCsvRow(['Include', 'Portfolio Key', 'Portfolio Name', 'Description', 'Visibility', 'Member Project Key', 'Member Project Name', 'Target Organization'])];
  if (resourceMappings?.portfoliosByOrg) {
    for (const [orgKey, portfolios] of resourceMappings.portfoliosByOrg) {
      for (const portfolio of portfolios) {
        // Portfolio header row (empty member fields)
        rows.push(toCsvRow(['yes', portfolio.key, portfolio.name, portfolio.description || '', portfolio.visibility || 'public', '', '', orgKey]));
        // One row per member project
        if (portfolio.projects) {
          for (const project of portfolio.projects) {
            rows.push(toCsvRow(['yes', portfolio.key, portfolio.name, '', '', project.key, project.name, orgKey]));
          }
        }
      }
    }
  }
  return rows.join('\n') + '\n';
}

export function generateTemplateMappingsCsv(data) {
  const { resourceMappings } = data;
  const rows = [toCsvRow(['Include', 'Template Name', 'Description', 'Key Pattern', 'Permission Key', 'Group Name', 'Target Organization'])];
  if (resourceMappings?.templatesByOrg) {
    for (const [orgKey, templates] of resourceMappings.templatesByOrg) {
      for (const template of templates) {
        // Template header row (empty permission fields)
        rows.push(toCsvRow(['yes', template.name, template.description || '', template.projectKeyPattern || '', '', '', orgKey]));
        // One row per permission+group assignment
        if (template.permissions) {
          for (const perm of template.permissions) {
            if (perm.groups) {
              for (const groupName of perm.groups) {
                rows.push(toCsvRow(['yes', template.name, '', '', perm.key, groupName, orgKey]));
              }
            }
          }
        }
      }
    }
  }
  return rows.join('\n') + '\n';
}

export function generateGlobalPermissionsCsv(data) {
  const { extractedData } = data;
  const rows = [toCsvRow(['Include', 'Group Name', 'Permission'])];
  const globalPermissions = extractedData?.globalPermissions || [];
  for (const group of globalPermissions) {
    if (group.permissions) {
      for (const permission of group.permissions) {
        rows.push(toCsvRow(['yes', group.name, permission]));
      }
    }
  }
  return rows.join('\n') + '\n';
}
