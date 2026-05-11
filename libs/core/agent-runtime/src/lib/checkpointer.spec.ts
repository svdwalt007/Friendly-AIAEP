import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.mock() is hoisted to the very top of the file, BEFORE imports. Any
// variables referenced inside the factory must therefore also be hoisted.
// `vi.hoisted()` runs eagerly with the mock factories, so any references
// inside `vi.mock(...)` factories below see live bindings.
const hoisted = vi.hoisted(() => {
  const mockRelease = vi.fn();
  const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
  const mockConnect = vi.fn().mockResolvedValue({
    query: mockQuery,
    release: mockRelease,
  });
  const mockEnd = vi.fn().mockResolvedValue(undefined);
  const mockSetup = vi.fn().mockResolvedValue(undefined);
  const mockFromConnString = vi.fn();
  return {
    mockRelease,
    mockQuery,
    mockConnect,
    mockEnd,
    mockSetup,
    mockFromConnString,
  };
});

// Mock pg module - Pool must be a proper class constructor
vi.mock('pg', () => {
  class MockPool {
    connect: typeof hoisted.mockConnect;
    end: typeof hoisted.mockEnd;
    query: typeof hoisted.mockQuery;
    constructor(public config: any) {
      this.connect = hoisted.mockConnect;
      this.end = hoisted.mockEnd;
      this.query = hoisted.mockQuery;
    }
  }
  return { Pool: MockPool };
});

// Mock @langchain/langgraph-checkpoint-postgres
vi.mock('@langchain/langgraph-checkpoint-postgres', () => {
  hoisted.mockFromConnString.mockReturnValue({ setup: hoisted.mockSetup });
  return {
    PostgresSaver: {
      fromConnString: hoisted.mockFromConnString,
    },
  };
});

import {
  createCheckpointer,
  closeCheckpointer,
  createCheckpointerFromEnv,
  type CheckpointerConfig,
} from './checkpointer';

// Re-expose hoisted mocks under their previous local names so existing tests
// (which reference `mockConnect` etc. directly) continue to work unchanged.
const { mockRelease, mockQuery, mockConnect, mockEnd, mockSetup } = hoisted;

describe('checkpointer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default successful implementations
    mockConnect.mockResolvedValue({
      query: mockQuery,
      release: mockRelease,
    });
    mockEnd.mockResolvedValue(undefined);
    mockQuery.mockResolvedValue({ rows: [] });
    mockSetup.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.POSTGRES_HOST;
    delete process.env.POSTGRES_PORT;
    delete process.env.POSTGRES_DB;
    delete process.env.POSTGRES_USER;
    delete process.env.POSTGRES_PASSWORD;
    delete process.env.POSTGRES_MAX_CONNECTIONS;
    delete process.env.POSTGRES_SSL;
  });

  describe('createCheckpointer', () => {
    it('should create a checkpointer with default configuration', async () => {
      const config: CheckpointerConfig = {
        host: 'localhost',
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
      };

      const instance = await createCheckpointer(config);

      expect(instance).toBeDefined();
      expect(instance.checkpointer).toBeDefined();
      expect(instance.pool).toBeDefined();
      expect(instance.close).toBeDefined();
      expect(typeof instance.close).toBe('function');
    });

    it('should create a checkpointer with custom configuration', async () => {
      const config: CheckpointerConfig = {
        host: 'db.example.com',
        port: 5433,
        database: 'custom_db',
        user: 'custom_user',
        password: 'custom_password',
        maxConnections: 20,
        idleTimeoutMillis: 60000,
        connectionTimeoutMillis: 10000,
        ssl: true,
      };

      const instance = await createCheckpointer(config);
      expect(instance).toBeDefined();
    });

    it('should test database connection', async () => {
      const config: CheckpointerConfig = {
        host: 'localhost',
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
      };

      await createCheckpointer(config);
      expect(mockConnect).toHaveBeenCalled();
    });

    it('should setup checkpoints table', async () => {
      const { PostgresSaver } = await import(
        '@langchain/langgraph-checkpoint-postgres'
      );

      const config: CheckpointerConfig = {
        host: 'localhost',
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
      };

      await createCheckpointer(config);

      expect(PostgresSaver.fromConnString).toHaveBeenCalledWith(
        'postgresql://test_user:test_password@localhost:5432/test_db'
      );
      expect(mockSetup).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      mockConnect.mockRejectedValueOnce(new Error('Connection failed'));

      const config: CheckpointerConfig = {
        host: 'localhost',
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
      };

      await expect(createCheckpointer(config)).rejects.toThrow(
        'Failed to create PostgreSQL checkpointer: Connection failed'
      );
    });

    it('should cleanup pool on error', async () => {
      mockSetup.mockRejectedValueOnce(new Error('Setup failed'));

      const config: CheckpointerConfig = {
        host: 'localhost',
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
      };

      await expect(createCheckpointer(config)).rejects.toThrow();
      expect(mockEnd).toHaveBeenCalled();
    });

    it('should handle SSL configuration as object', async () => {
      const sslConfig = {
        rejectUnauthorized: false,
        ca: 'cert-content',
      };

      const config: CheckpointerConfig = {
        host: 'localhost',
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
        ssl: sslConfig,
      };

      const instance = await createCheckpointer(config);
      expect(instance).toBeDefined();
    });

    it('should handle non-Error exceptions', async () => {
      mockConnect.mockRejectedValueOnce('string error');

      const config: CheckpointerConfig = {
        host: 'localhost',
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
      };

      await expect(createCheckpointer(config)).rejects.toThrow(
        'Failed to create PostgreSQL checkpointer: Unknown error'
      );
    });

    it('should use default port when not specified', async () => {
      const config: CheckpointerConfig = {
        host: 'localhost',
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
      };

      const instance = await createCheckpointer(config);
      expect(instance).toBeDefined();
      // Default port 5432 is used internally
    });

    it('should not set ssl when not provided', async () => {
      const config: CheckpointerConfig = {
        host: 'localhost',
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
      };

      const instance = await createCheckpointer(config);
      expect(instance).toBeDefined();
    });
  });

  describe('closeCheckpointer', () => {
    it('should close pool and release resources', async () => {
      const config: CheckpointerConfig = {
        host: 'localhost',
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
      };

      const instance = await createCheckpointer(config);
      await closeCheckpointer(instance);

      expect(mockEnd).toHaveBeenCalled();
    });

    it('should handle close via instance.close()', async () => {
      const config: CheckpointerConfig = {
        host: 'localhost',
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
      };

      const instance = await createCheckpointer(config);
      await instance.close();

      expect(mockEnd).toHaveBeenCalled();
    });
  });

  describe('createCheckpointerFromEnv', () => {
    it('should create checkpointer from environment variables with defaults', async () => {
      process.env.POSTGRES_DB = 'env_db';
      process.env.POSTGRES_USER = 'env_user';
      process.env.POSTGRES_PASSWORD = 'env_password';

      const instance = await createCheckpointerFromEnv();
      expect(instance).toBeDefined();
    });

    it('should create checkpointer from environment variables with custom values', async () => {
      process.env.POSTGRES_HOST = 'env-host.example.com';
      process.env.POSTGRES_PORT = '5433';
      process.env.POSTGRES_DB = 'env_db';
      process.env.POSTGRES_USER = 'env_user';
      process.env.POSTGRES_PASSWORD = 'env_password';
      process.env.POSTGRES_MAX_CONNECTIONS = '20';
      process.env.POSTGRES_SSL = 'true';

      const instance = await createCheckpointerFromEnv();
      expect(instance).toBeDefined();
    });

    it('should throw error when required env vars are missing', async () => {
      process.env.POSTGRES_DB = 'env_db';
      process.env.POSTGRES_USER = 'env_user';
      // POSTGRES_PASSWORD is missing

      await expect(createCheckpointerFromEnv()).rejects.toThrow(
        'Missing required environment variables: POSTGRES_PASSWORD'
      );
    });

    it('should throw error when multiple required env vars are missing', async () => {
      await expect(createCheckpointerFromEnv()).rejects.toThrow(
        'Missing required environment variables: POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD'
      );
    });

    it('should parse port as integer', async () => {
      process.env.POSTGRES_PORT = '9999';
      process.env.POSTGRES_DB = 'env_db';
      process.env.POSTGRES_USER = 'env_user';
      process.env.POSTGRES_PASSWORD = 'env_password';

      const instance = await createCheckpointerFromEnv();
      expect(instance).toBeDefined();
    });

    it('should parse max connections as integer', async () => {
      process.env.POSTGRES_MAX_CONNECTIONS = '50';
      process.env.POSTGRES_DB = 'env_db';
      process.env.POSTGRES_USER = 'env_user';
      process.env.POSTGRES_PASSWORD = 'env_password';

      const instance = await createCheckpointerFromEnv();
      expect(instance).toBeDefined();
    });

    it('should use default SSL false when POSTGRES_SSL is not true', async () => {
      process.env.POSTGRES_DB = 'env_db';
      process.env.POSTGRES_USER = 'env_user';
      process.env.POSTGRES_PASSWORD = 'env_password';
      process.env.POSTGRES_SSL = 'false';

      const instance = await createCheckpointerFromEnv();
      expect(instance).toBeDefined();
    });
  });
});
