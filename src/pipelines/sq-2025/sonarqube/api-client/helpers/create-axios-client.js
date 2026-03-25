import axios from 'axios';
import { handleApiError } from './handle-api-error.js';

// -------- Create Axios Client --------

/** Create an Axios instance configured for the SonarQube API. */
export function createAxiosClient(baseURL, token) {
  const client = axios.create({
    baseURL,
    auth: { username: token, password: '' },
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    timeout: 30000,
  });

  client.interceptors.response.use(
    response => response,
    error => handleApiError(error, baseURL),
  );

  return client;
}
