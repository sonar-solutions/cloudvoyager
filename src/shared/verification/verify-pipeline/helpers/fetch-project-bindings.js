// -------- Fetch Project Bindings --------

import { mapConcurrent } from '../../../utils/concurrency.js';

/**
 * Fetch DevOps bindings for all projects from SonarQube.
 * @param {object} sqClient - SonarQube client
 * @param {Array} allProjects - All projects
 * @returns {Promise<Map>} Map of projectKey → binding
 */
export async function fetchProjectBindings(sqClient, allProjects) {
  const projectBindings = new Map();

  await mapConcurrent(allProjects, async (project) => {
    try {
      const binding = await sqClient.getProjectBinding(project.key);
      if (binding) projectBindings.set(project.key, binding);
    } catch (_) { /* no binding */ }
  }, { concurrency: 10, settled: true });

  return projectBindings;
}
