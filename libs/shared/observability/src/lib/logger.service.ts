/**
 * Enhanced Logger Service with OpenTelemetry Integration
 *
 * Features:
 * - Structured logging with Pino
 * - Trace ID correlation
 * - Environment-specific log levels
 * - Log enrichment with metadata
 * - Integration with OpenTelemetry spans
 *
 * @module LoggerService
 */

import pino, { Logger as PinoLogger, LoggerOptions } from 'pino';
import { getTelemetry } from './telemetry.service';

/**
 * Log levels
 */
export enum LogLevel {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  name?: string;
  level?: LogLevel;
  prettyPrint?: boolean;
  redactPaths?: string[];
  destination?: string;
  enableTraceCorrelation?: boolean;
}

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  name: 'friendly-aep',
  level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
  prettyPrint: process.env.NODE_ENV === 'development',
  enableTraceCorrelation: true,
  redactPaths: [
    'password',
    'token',
    'apiKey',
    'secret',
    'authorization',
    'cookie',
    '*.password',
    '*.token',
    '*.apiKey',
    '*.secret',
  ],
};

/**
 * LoggerService - Enhanced structured logging with trace correlation
 */
export class LoggerService {
  private logger: PinoLogger;
  private config: Required<LoggerConfig>;

  constructor(config: LoggerConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      redactPaths: [...(DEFAULT_CONFIG.redactPaths || []), ...(config.redactPaths || [])],
    } as Required<LoggerConfig>;

    this.logger = this.createLogger();
  }

  /**
   * Create Pino logger with configuration
   */
  private createLogger(): PinoLogger {
    const pinoOptions: LoggerOptions = {
      name: this.config.name,
      level: this.config.level,
      redact: {
        paths: this.config.redactPaths,
        censor: '[REDACTED]',
      },
      formatters: {
        level: (label: string) => {
          return { level: label };
        },
        bindings: (bindings: any) => {
          return {
            pid: bindings.pid,
            hostname: bindings.hostname,
            service: this.config.name,
          };
        },
      },
      serializers: {
        err: pino.stdSerializers.err,
        error: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    };

    // Production logging format
    if (!this.config.prettyPrint) {
      return pino(pinoOptions);
    }

    // Development logging format with pretty print
    return pino(
      pinoOptions,
      pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
          singleLine: false,
          messageFormat: '{levelLabel} - {msg}',
        },
      })
    );
  }

  /**
   * Enrich log data with trace context
   */
  private enrichWithTraceContext(data?: object): object {
    if (!this.config.enableTraceCorrelation) {
      return data || {};
    }

    try {
      const telemetry = getTelemetry();
      const traceContext = telemetry.getTraceContext();

      return {
        ...data,
        trace_id: traceContext.traceId,
        span_id: traceContext.spanId,
        trace_flags: traceContext.traceFlags,
      };
    } catch (error) {
      // Telemetry not initialized, skip trace context
      return data || {};
    }
  }

  /**
   * Log trace level message
   */
  trace(message: string, data?: object): void {
    this.logger.trace(this.enrichWithTraceContext(data), message);
  }

  /**
   * Log debug level message
   */
  debug(message: string, data?: object): void {
    this.logger.debug(this.enrichWithTraceContext(data), message);
  }

  /**
   * Log info level message
   */
  info(message: string, data?: object): void {
    this.logger.info(this.enrichWithTraceContext(data), message);
  }

  /**
   * Log warning level message
   */
  warn(message: string, data?: object): void {
    this.logger.warn(this.enrichWithTraceContext(data), message);
  }

  /**
   * Log error level message
   */
  error(message: string, error?: Error | object, data?: object): void {
    const errorData = error instanceof Error ? { err: error, ...data } : { ...error, ...data };
    this.logger.error(this.enrichWithTraceContext(errorData), message);

    // Record exception in current span if available
    if (error instanceof Error) {
      try {
        const telemetry = getTelemetry();
        telemetry.recordException(error);
      } catch {
        // Telemetry not available, skip
      }
    }
  }

  /**
   * Log fatal level message
   */
  fatal(message: string, error?: Error | object, data?: object): void {
    const errorData = error instanceof Error ? { err: error, ...data } : { ...error, ...data };
    this.logger.fatal(this.enrichWithTraceContext(errorData), message);

    // Record exception in current span if available
    if (error instanceof Error) {
      try {
        const telemetry = getTelemetry();
        telemetry.recordException(error);
      } catch {
        // Telemetry not available, skip
      }
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(bindings: object): LoggerService {
    const childLogger = new LoggerService(this.config);
    childLogger.logger = this.logger.child(bindings);
    return childLogger;
  }

  /**
   * Get the underlying Pino logger instance
   */
  getPinoLogger(): PinoLogger {
    return this.logger;
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.logger.level = level;
  }

  /**
   * Get current log level
   */
  getLevel(): string {
    return this.logger.level;
  }

  /**
   * Log HTTP request
   */
  logRequest(req: {
    method: string;
    url: string;
    headers?: object;
    query?: object;
    params?: object;
    body?: object;
  }): void {
    this.info('HTTP Request', {
      http: {
        method: req.method,
        url: req.url,
        query: req.query,
        params: req.params,
      },
    });
  }

  /**
   * Log HTTP response
   */
  logResponse(
    req: { method: string; url: string },
    res: { statusCode: number },
    duration: number
  ): void {
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    this.logger[level](
      this.enrichWithTraceContext({
        http: {
          method: req.method,
          url: req.url,
          status_code: res.statusCode,
          duration_ms: duration,
        },
      }),
      `HTTP Response ${res.statusCode}`
    );
  }

  /**
   * Log database query
   */
  logQuery(query: string, duration?: number, params?: unknown[]): void {
    this.debug('Database Query', {
      db: {
        query,
        duration_ms: duration,
        params: params ? '[PARAMS]' : undefined, // Redact actual params for security
      },
    });
  }

  /**
   * Log business event
   */
  logEvent(event: string, data?: object): void {
    this.info('Business Event', {
      event,
      ...data,
    });
  }

  /**
   * Log performance metric
   */
  logPerformance(operation: string, duration: number, data?: object): void {
    const level = duration > 1000 ? 'warn' : 'debug';
    this.logger[level](
      this.enrichWithTraceContext({
        performance: {
          operation,
          duration_ms: duration,
        },
        ...data,
      }),
      `Performance: ${operation} took ${duration}ms`
    );
  }

  /**
   * Log security event
   */
  logSecurity(event: string, severity: 'low' | 'medium' | 'high' | 'critical', data?: object): void {
    const level = severity === 'critical' ? 'error' : severity === 'high' ? 'warn' : 'info';
    this.logger[level](
      this.enrichWithTraceContext({
        security: {
          event,
          severity,
        },
        ...data,
      }),
      `Security Event: ${event}`
    );
  }
}

/**
 * Singleton logger instance
 */
let defaultLogger: LoggerService | null = null;

/**
 * Get or create the default logger instance
 */
export function getLogger(config?: LoggerConfig): LoggerService {
  if (!defaultLogger) {
    defaultLogger = new LoggerService(config);
  }
  return defaultLogger;
}

/**
 * Create a new logger instance (non-singleton)
 */
export function createLogger(config?: LoggerConfig): LoggerService {
  return new LoggerService(config);
}
