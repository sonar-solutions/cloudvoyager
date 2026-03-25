import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Enrich assignee logins with display name and email from SonarQube user API.
export async function enrichAssigneeDetails(sqClient, logins) {
  const details = new Map();

  for (const login of logins) {
    try {
      const response = await sqClient.client.get('/api/users/search', {
        params: { q: login, ps: 10 }
      });
      const users = response.data.users || [];
      const match = users.find(u => u.login === login);
      if (match) {
        details.set(login, { name: match.name || '', email: match.email || '' });
      } else {
        details.set(login, { name: '', email: '' });
      }
    } catch (error) {
      logger.debug(`Failed to get user details for ${login}: ${error.message}`);
      details.set(login, { name: '', email: '' });
    }
  }

  return details;
}
