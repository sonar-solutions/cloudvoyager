import winston from 'winston';
import fs from 'fs';
import path from 'path';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack }) => {
  if (stack) {
    return `${timestamp} [${level}]: ${message}\n${stack}`;
  }
  return `${timestamp} [${level}]: ${message}`;
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      )
    })
  ]
});

// Add file transport if LOG_FILE environment variable is set
if (process.env.LOG_FILE) {
  logger.add(new winston.transports.File({
    filename: process.env.LOG_FILE,
    format: combine(
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      logFormat
    )
  }));
}

/**
 * Enable automatic file logging for a command run.
 * Creates a timestamped log file in a `logs/` directory next to the working directory.
 * The file transport always logs at 'debug' level so the full log is captured
 * regardless of the console log level.
 *
 * @param {string} commandName - Name of the command (e.g. 'migrate', 'transfer')
 * @returns {string} The absolute path to the log file
 */
export function enableFileLogging(commandName) {
  const logsDir = path.resolve('migration-output', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logFileName = `cloudvoyager-${commandName}-${ts}.log`;
  const logFilePath = path.join(logsDir, logFileName);

  logger.add(new winston.transports.File({
    filename: logFilePath,
    level: 'debug',
    format: combine(
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      logFormat
    )
  }));

  logger.info(`Full logs will be written to: ${logFilePath}`);
  return logFilePath;
}

export default logger;
