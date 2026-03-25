import logger from '../../../../../shared/utils/logger.js';

// -------- Post Report --------

/**
 * Post the buffered form to /api/ce/submit with a race-timeout.
 */
export async function postReport(client, formBuffer, formHeaders, timeoutMs) {
  const postPromise = client.client.post('/api/ce/submit', formBuffer, {
    headers: { ...formHeaders, 'content-length': formBuffer.length },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 300_000,
    onUploadProgress: (ev) => {
      if (ev.total) {
        logger.debug(`Upload progress: ${Math.round((ev.loaded / ev.total) * 100)}% (${(ev.loaded / 1024).toFixed(0)} KB / ${(ev.total / 1024).toFixed(0)} KB)`);
      } else {
        logger.debug(`Upload progress: ${(ev.loaded / 1024).toFixed(0)} KB sent`);
      }
    },
  });

  const TIMEOUT = Symbol('timeout');
  let timeoutId;
  const timeoutPromise = new Promise(resolve => { timeoutId = setTimeout(() => resolve(TIMEOUT), timeoutMs); });

  const result = await Promise.race([postPromise, timeoutPromise]).catch(error => error);
  clearTimeout(timeoutId);

  return { result, TIMEOUT };
}
