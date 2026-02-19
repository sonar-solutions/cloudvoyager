import logger from '../../utils/logger.js';

export async function transitionIssue(client, issue, transition) {
  logger.debug(`Transitioning issue ${issue}: ${transition}`);

  await client.post('/api/issues/do_transition', null, {
    params: { issue, transition }
  });
}

export async function assignIssue(client, issue, assignee) {
  logger.debug(`Assigning issue ${issue} to ${assignee || '(unassign)'}`);

  await client.post('/api/issues/assign', null, {
    params: { issue, assignee }
  });
}

export async function addIssueComment(client, issue, text) {
  logger.debug(`Adding comment to issue ${issue}`);

  await client.post('/api/issues/add_comment', null, {
    params: { issue, text }
  });
}

export async function setIssueTags(client, issue, tags) {
  logger.debug(`Setting tags on issue ${issue}: ${tags.join(', ')}`);

  await client.post('/api/issues/set_tags', null, {
    params: { issue, tags: tags.join(',') }
  });
}

export async function searchIssues(client, organization, projectKey, filters = {}) {
  logger.debug(`Searching issues in project: ${projectKey}`);

  let allResults = [];
  let page = 1;
  const pageSize = 500;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await client.get('/api/issues/search', {
      params: {
        componentKeys: projectKey,
        organization,
        ps: pageSize,
        p: page,
        ...filters
      }
    });

    const issues = response.data.issues || [];
    allResults = allResults.concat(issues);

    const total = response.data.paging?.total || 0;
    if (page * pageSize >= total || issues.length < pageSize) break;
    page++;
  }

  return allResults;
}
