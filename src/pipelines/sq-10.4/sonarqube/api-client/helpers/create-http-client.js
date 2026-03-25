import axios from 'axios';
import { handleApiError } from './handle-api-error.js';

// -------- Main Logic --------

// Create configured axios client for SonarQube API.
export function createHttpClient(baseURL, token) {
  const client = axios.create({
    baseURL,
    auth: { username: token, password: '' },
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    timeout: 30000
  });
  client.interceptors.response.use(
    response => response,
    error => handleApiError(error, baseURL)
  );
  return client;
}
