import logger from '../../../../../shared/utils/logger.js';

// -------- Post Report to API --------

const RESPONSE_TIMEOUT_MS = 60_000;

/**
 * Post the buffered form data to /api/ce/submit.
 * Returns the Axios response, 'TIMEOUT' symbol, or the caught Error.
 */
export async function postReportToApi(client, formHeaders, formBuffer) {
  const postPromise = client.client.post('/api/ce/submit', formBuffer, {
    headers: { ...formHeaders, 'content-length': formBuffer.length },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 300_000,
    onUploadProgress: (evt) => {
      if (evt.total) {
        logger.debug(`Upload progress: ${Math.round((evt.loaded / evt.total) * 100)}%`);
      } else {
        logger.debug(`Upload progress: ${(evt.loaded / 1024).toFixed(0)} KB sent`);
      }
    },
  });

  let timeoutId;
  const timeoutPromise = new Promise(resolve => {
    timeoutId = setTimeout(() => resolve('TIMEOUT'), RESPONSE_TIMEOUT_MS);
  });

  const result = await Promise.race([postPromise, timeoutPromise]).catch(error => error);
  clearTimeout(timeoutId);
  return result;
}
