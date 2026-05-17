import { describe, expect, it } from 'vitest';
import {
  createLogger,
  getLogger,
  LoggerService,
  LogLevel,
} from './logger.service';

describe('LoggerService', () => {
  it('constructs with defaults', () => {
    const log = new LoggerService();
    expect(log).toBeInstanceOf(LoggerService);
    expect(log.getLevel()).toMatch(/^(trace|debug|info|warn|error|fatal)$/);
  });

  it('honours an explicit level', () => {
    const log = new LoggerService({ level: LogLevel.WARN, prettyPrint: false });
    expect(log.getLevel()).toBe('warn');
    log.setLevel(LogLevel.ERROR);
    expect(log.getLevel()).toBe('error');
  });

  it.each([
    ['trace'],
    ['debug'],
    ['info'],
    ['warn'],
  ] as const)('logs at %s level without throwing', (lvl) => {
    const log = new LoggerService({ level: LogLevel.TRACE, prettyPrint: false });
    expect(() => log[lvl]('msg', { k: 'v' })).not.toThrow();
  });

  it('error accepts an Error instance and extra data', () => {
    const log = new LoggerService({ prettyPrint: false });
    expect(() => log.error('boom', new Error('x'), { uid: 1 })).not.toThrow();
    expect(() => log.error('plain', { only: 'data' })).not.toThrow();
  });

  it('fatal accepts an Error instance', () => {
    const log = new LoggerService({ prettyPrint: false });
    expect(() => log.fatal('done', new Error('x'))).not.toThrow();
  });

  it('child() returns a LoggerService that does not throw on use', () => {
    const log = new LoggerService({ prettyPrint: false });
    const child = log.child({ scope: 'sub' });
    expect(child).toBeInstanceOf(LoggerService);
    expect(() => child.info('hello')).not.toThrow();
  });

  it('logRequest / logResponse / logQuery / logEvent / logPerformance / logSecurity do not throw', () => {
    const log = new LoggerService({ prettyPrint: false, level: LogLevel.TRACE });
    expect(() =>
      log.logRequest({ method: 'GET', url: '/x', headers: {}, body: {} }),
    ).not.toThrow();
    expect(() =>
      log.logResponse({ method: 'GET', url: '/x' }, { statusCode: 200 }, 5),
    ).not.toThrow();
    expect(() =>
      log.logResponse({ method: 'GET', url: '/x' }, { statusCode: 500 }, 5),
    ).not.toThrow();
    expect(() => log.logQuery('SELECT 1', 3, [1])).not.toThrow();
    expect(() => log.logEvent('user.created', { id: 1 })).not.toThrow();
    expect(() => log.logPerformance('op', 50)).not.toThrow();
    expect(() => log.logPerformance('slow', 2000)).not.toThrow();
    expect(() =>
      log.logSecurity('login.fail', 'critical', { ip: '1.2.3.4' }),
    ).not.toThrow();
    expect(() => log.logSecurity('login.fail', 'low')).not.toThrow();
  });

  it('getPinoLogger returns the wrapped instance', () => {
    const log = new LoggerService({ prettyPrint: false });
    expect(log.getPinoLogger()).toBeTruthy();
  });
});

describe('createLogger / getLogger factories', () => {
  it('createLogger returns fresh instances', () => {
    const a = createLogger({ prettyPrint: false });
    const b = createLogger({ prettyPrint: false });
    expect(a).not.toBe(b);
  });

  it('getLogger returns a singleton across repeated calls', () => {
    const first = getLogger({ prettyPrint: false });
    const second = getLogger();
    expect(first).toBe(second);
  });
});
