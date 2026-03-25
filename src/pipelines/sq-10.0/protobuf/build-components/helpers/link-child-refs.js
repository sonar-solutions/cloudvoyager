// -------- Link Child Refs --------

export function linkChildRefs(componentsMap) {
  const projectComponent = Array.from(componentsMap.values()).find(c => c.type === 1);

  componentsMap.forEach((component) => {
    if (component.type === 4 && projectComponent) {
      projectComponent.childRef.push(component.ref);
    }
  });
}
