// -------- Create Component Data --------

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
