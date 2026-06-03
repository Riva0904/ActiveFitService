import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';

// Redact common PII patterns from log output before writing
function scrubPii(message: string): string {
  return message
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
    .replace(/\b(\+91|0)?\s?[6-9]\d{9}\b/g, '[PHONE]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[UUID]');
}

const isProduction = process.env.NODE_ENV === 'production';

const winstonLogger = winston.createLogger({
  level: isProduction ? 'warn' : 'debug',
  format: isProduction
    ? winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      )
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ level, message, timestamp, context }) =>
          `${timestamp} [${context ?? 'App'}] ${level}: ${message}`,
        ),
      ),
  transports: [new winston.transports.Console()],
});

@Injectable()
export class AppLoggerService implements LoggerService {
  log(message: string, context?: string) {
    winstonLogger.info(scrubPii(message), { context });
  }
  error(message: string, trace?: string, context?: string) {
    winstonLogger.error(scrubPii(message), { trace, context });
  }
  warn(message: string, context?: string) {
    winstonLogger.warn(scrubPii(message), { context });
  }
  debug(message: string, context?: string) {
    winstonLogger.debug(scrubPii(message), { context });
  }
  verbose(message: string, context?: string) {
    winstonLogger.verbose(scrubPii(message), { context });
  }
}
