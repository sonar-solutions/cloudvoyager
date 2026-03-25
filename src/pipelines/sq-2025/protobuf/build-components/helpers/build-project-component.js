// -------- Build Project Component --------

/** Build the root project component. */
export function buildProjectComponent(builder) {
  const project = builder.data.project.project;
  return {
    ref: builder.getComponentRef(project.key),
    type: 1, // ComponentType.PROJECT
    childRef: [],
    key: builder.sonarCloudConfig.projectKey || project.key,
  };
}
