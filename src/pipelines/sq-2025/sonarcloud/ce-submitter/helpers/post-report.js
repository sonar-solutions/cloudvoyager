import logger from '../../../../../shared/utils/logger.js';

// -------- Post Report --------

/** Post the buffered form data to /api/ce/submit with a timeout race. */
export async function postReport(client, formHeaders, formBuffer, timeoutMs) {
  const postPromise = client.client.post('/api/ce/submit', formBuffer, {
    headers: { ...formHeaders, 'content-length': formBuffer.length },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 300_000,
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total) {
        const pct = Math.round((progressEvent.loaded / progressEvent.total) * 100);
        logger.debug(`Upload progress: ${pct}% (${(progressEvent.loaded / 1024).toFixed(0)} KB / ${(progressEvent.total / 1024).toFixed(0)} KB)`);
      } else {
        logger.debug(`Upload progress: ${(progressEvent.loaded / 1024).toFixed(0)} KB sent`);
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
