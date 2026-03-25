import axios from 'axios';
import { handleSonarQubeError } from './handle-error.js';

// -------- Create Configured Axios Client for SonarQube --------

export function createAxiosClient(config) {
  const baseURL = config.url.replace(/\/$/, '');
  const client = axios.create({
    baseURL,
    auth: { username: config.token, password: '' },
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    timeout: 30000,
  });

  client.interceptors.response.use(
    response => response,
    error => handleSonarQubeError(error, baseURL),
  );

  return { client, baseURL, token: config.token, projectKey: config.projectKey };
}
