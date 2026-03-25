// -------- Main Logic --------

// Create a component data object from a SonarQube component.
export function createComponentData(component) {
  return {
    key: component.key,
    name: component.name,
    qualifier: component.qualifier,
    path: component.path,
    language: component.language,
    measures: component.measures || [],
  };
}
