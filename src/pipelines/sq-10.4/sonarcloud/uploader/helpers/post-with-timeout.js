import { buildSubmitForm } from './build-submit-form.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * POST the report to /api/ce/submit with a response timeout.
 * Returns { response }, { timeout: true }, or { error }.
 */
export async function postWithTimeout(client, reportData, metadata) {
  const RESPONSE_TIMEOUT_MS = 60_000;
  const form = buildSubmitForm(client, reportData, metadata);

  // Buffer form data to avoid streaming issues in Bun
  const formHeaders = form.getHeaders();
  const formBuffer = await new Promise((resolve, reject) => {
    const chunks = [];
    form.on('data', chunk => chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk));
    form.on('end', () => resolve(Buffer.concat(chunks)));
    form.on('error', reject);
    form.resume();
  });

  const postPromise = client.client.post('/api/ce/submit', formBuffer, {
    headers: { ...formHeaders, 'content-length': formBuffer.length },
    maxBodyLength: Infinity, maxContentLength: Infinity, timeout: 300_000,
    onUploadProgress: (evt) => {
      if (evt.total) logger.debug(`Upload progress: ${Math.round((evt.loaded / evt.total) * 100)}%`);
      else logger.debug(`Upload progress: ${(evt.loaded / 1024).toFixed(0)} KB sent`);
    },
  });

  const TIMEOUT = Symbol('timeout');
  let timeoutId;
  const timeoutPromise = new Promise(resolve => { timeoutId = setTimeout(() => resolve(TIMEOUT), RESPONSE_TIMEOUT_MS); });

  const result = await Promise.race([postPromise, timeoutPromise]).catch(error => error);
  clearTimeout(timeoutId);

  if (result === TIMEOUT) {
    logger.warn(`No response from /api/ce/submit after ${RESPONSE_TIMEOUT_MS / 1000}s`);
    return { timeout: true };
  }
  if (result instanceof Error) return { error: result };
  return { response: result };
}
