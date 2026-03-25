// -------- Check Shutdown --------
import { GracefulShutdownError } from '../../errors.js';

export function checkShutdown(shutdownCheck) {
  if (shutdownCheck && shutdownCheck()) {
    throw new GracefulShutdownError();
  }
}
