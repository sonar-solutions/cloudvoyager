// Re-export from folder structure for backward compatibility
export { createReportUploader } from './uploader/index.js';

// -------- Backward-Compatible Class Wrapper --------

import { createReportUploader } from './uploader/index.js';

export class ReportUploader {
  constructor(client) {
    const instance = createReportUploader(client);
    Object.assign(this, instance);
  }
}
