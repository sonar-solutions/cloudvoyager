// -------- Group Projects by DevOps Binding --------
import { buildBindingGroupKey } from './build-binding-group-key.js';

export function groupProjectsByBinding(projects, bindings) {
  const bindingGroups = new Map();
  const unboundProjects = [];

  for (const project of projects) {
    const binding = bindings.get(project.key);
    if (!binding) { unboundProjects.push(project); continue; }

    const groupKey = buildBindingGroupKey(binding);
    if (!bindingGroups.has(groupKey)) {
      bindingGroups.set(groupKey, { alm: binding.alm, identifier: groupKey, url: binding.url || '', projects: [] });
    }
    bindingGroups.get(groupKey).projects.push(project);
  }

  return { bindingGroups, unboundProjects };
}
