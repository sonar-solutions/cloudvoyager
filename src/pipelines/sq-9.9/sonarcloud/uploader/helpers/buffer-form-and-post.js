import logger from '../../../../../shared/utils/logger.js';

// -------- Buffer Form Data and POST to CE Endpoint --------

export async function bufferFormAndPost(client, form) {
  const formHeaders = form.getHeaders();
  const formBuffer = await new Promise((resolve, reject) => {
    const chunks = [];
    form.on('data', chunk => chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk));
    form.on('end', () => resolve(Buffer.concat(chunks)));
    form.on('error', reject);
    form.resume();
  });

  return client.client.post('/api/ce/submit', formBuffer, {
    headers: { ...formHeaders, 'content-length': formBuffer.length },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 300_000,
    onUploadProgress: (ev) => {
      if (ev.total) {
        const pct = Math.round((ev.loaded / ev.total) * 100);
        logger.debug(`Upload progress: ${pct}% (${(ev.loaded / 1024).toFixed(0)} KB / ${(ev.total / 1024).toFixed(0)} KB)`);
      } else {
        logger.debug(`Upload progress: ${(ev.loaded / 1024).toFixed(0)} KB sent`);
      }
    },
  });
}
