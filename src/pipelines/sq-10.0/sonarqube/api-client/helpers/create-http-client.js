import axios from 'axios';

// -------- Create Axios HTTP Client --------

export function createHttpClient(baseURL, token, handleError) {
  const client = axios.create({
    baseURL,
    headers: { 'Authorization': `Basic ${Buffer.from(`${token}:`).toString('base64')}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    timeout: 30000,
  });
  client.interceptors.response.use(
    response => response,
    error => handleError(error),
  );
  return client;
}
