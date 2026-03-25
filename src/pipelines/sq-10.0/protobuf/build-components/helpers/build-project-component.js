// -------- Build Project Component --------

export function buildProjectComponent(builder, componentsMap) {
  const project = builder.data.project.project;
  componentsMap.set(project.key, {
    ref: builder.getComponentRef(project.key),
    type: 1, // ComponentType.PROJECT
    childRef: [],
    key: builder.sonarCloudConfig.projectKey || project.key
  });
}
