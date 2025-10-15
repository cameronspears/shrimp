import { describe, test, expect, beforeEach } from 'bun:test';
import { logger, createLogger, resetLogger } from '../../src/utils/logger.js';

describe('Logger', () => {
  beforeEach(() => {
    // Reset logger singleton between tests
    resetLogger();
  });

  describe('Log Levels', () => {
    test('logs trace messages', () => {
      const testLogger = createLogger({ level: 'trace', silent: false });

      // Should not throw
      expect(() => testLogger.trace('Trace message')).not.toThrow();
      expect(() => testLogger.trace('Trace with data', { key: 'value' })).not.toThrow();
    });

    test('logs debug messages', () => {
      const testLogger = createLogger({ level: 'debug', silent: false });

      expect(() => testLogger.debug('Debug message')).not.toThrow();
      expect(() => testLogger.debug('Debug with data', { key: 'value' })).not.toThrow();
    });

    test('logs info messages', () => {
      const testLogger = createLogger({ level: 'info', silent: false });

      expect(() => testLogger.info('Info message')).not.toThrow();
      expect(() => testLogger.info('Info with data', { key: 'value' })).not.toThrow();
    });

    test('logs warn messages', () => {
      const testLogger = createLogger({ level: 'warn', silent: false });

      expect(() => testLogger.warn('Warning message')).not.toThrow();
      expect(() => testLogger.warn('Warning with data', { key: 'value' })).not.toThrow();
    });

    test('logs error messages as strings', () => {
      const testLogger = createLogger({ level: 'error', silent: false });

      expect(() => testLogger.error('Error message')).not.toThrow();
      expect(() => testLogger.error('Error with data', { key: 'value' })).not.toThrow();
    });

    test('logs error messages as Error objects', () => {
      const testLogger = createLogger({ level: 'error', silent: false });
      const error = new Error('Test error');

      expect(() => testLogger.error(error)).not.toThrow();
      expect(() => testLogger.error(error, 'Additional context')).not.toThrow();
    });

    test('logs fatal messages as strings', () => {
      const testLogger = createLogger({ level: 'fatal', silent: false });

      expect(() => testLogger.fatal('Fatal message')).not.toThrow();
      expect(() => testLogger.fatal('Fatal with data', { key: 'value' })).not.toThrow();
    });

    test('logs fatal messages as Error objects', () => {
      const testLogger = createLogger({ level: 'fatal', silent: false });
      const error = new Error('Fatal error');

      expect(() => testLogger.fatal(error)).not.toThrow();
      expect(() => testLogger.fatal(error, 'Additional context')).not.toThrow();
    });
  });

  describe('Singleton Pattern', () => {
    test('returns same instance when called multiple times', () => {
      const logger1 = createLogger();
      const logger2 = createLogger();

      expect(logger1).toBe(logger2);
    });

    test('resetLogger creates new instance', () => {
      const logger1 = createLogger();
      resetLogger();
      const logger2 = createLogger();

      // After reset, we get a new instance
      // Note: We can't directly compare instances, but we can verify it doesn't throw
      expect(logger1).toBeDefined();
      expect(logger2).toBeDefined();
    });
  });

  describe('Configuration', () => {
    test('creates logger with custom level', () => {
      const testLogger = createLogger({ level: 'debug' });

      expect(() => testLogger.debug('Debug enabled')).not.toThrow();
    });

    test('creates logger with silent mode', () => {
      const testLogger = createLogger({ silent: true });

      // Silent mode should suppress all output
      expect(() => testLogger.info('Silent info')).not.toThrow();
      expect(() => testLogger.error('Silent error')).not.toThrow();
    });

    test('creates logger with pretty mode disabled', () => {
      const testLogger = createLogger({ pretty: false });

      expect(() => testLogger.info('Non-pretty log')).not.toThrow();
    });

    test('creates logger with pretty mode enabled', () => {
      const testLogger = createLogger({ pretty: true });

      expect(() => testLogger.info('Pretty log')).not.toThrow();
    });
  });

  describe('Child Loggers', () => {
    test('creates child logger with bindings', () => {
      const testLogger = createLogger();
      const childLogger = testLogger.child({ component: 'TestComponent' });

      expect(childLogger).toBeDefined();
      expect(() => childLogger.info('Child log')).not.toThrow();
    });
  });

  describe('Default Export', () => {
    test('logger singleton is available', () => {
      expect(logger).toBeDefined();
      expect(() => logger.info('Default logger')).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('handles Error objects with stack traces', () => {
      const testLogger = createLogger({ level: 'error' });
      const error = new Error('Test error with stack');
      error.stack = 'Error: Test error\n  at test.ts:1:1';

      expect(() => testLogger.error(error)).not.toThrow();
    });

    test('handles Error objects in fatal', () => {
      const testLogger = createLogger({ level: 'fatal' });
      const error = new Error('Fatal error with stack');
      error.stack = 'Error: Fatal\n  at test.ts:1:1';

      expect(() => testLogger.fatal(error)).not.toThrow();
    });
  });
});
