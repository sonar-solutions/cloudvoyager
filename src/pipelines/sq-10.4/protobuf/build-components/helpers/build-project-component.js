// -------- Main Logic --------

// Build the root project component message.
export function buildProjectComponent(builder) {
  const project = builder.data.project.project;
  return {
    key: project.key,
    component: {
      ref: builder.getComponentRef(project.key),
      type: 1, // ComponentType.PROJECT
      childRef: [],
      key: builder.sonarCloudConfig.projectKey || project.key
    }
  };
}
