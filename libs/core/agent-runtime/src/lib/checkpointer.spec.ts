import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Pool } from 'pg';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import {
  createCheckpointer,
  closeCheckpointer,
  createCheckpointerFromEnv,
  type CheckpointerConfig,
} from './checkpointer';

// Mock pg module
vi.mock('pg', () => {
  const mockRelease = vi.fn();
  const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
  const mockConnect = vi.fn().mockResolvedValue({
    query: mockQuery,
    release: mockRelease,
  });
  const mockEnd = vi.fn().mockResolvedValue(undefined);

  const MockPool = vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    end: mockEnd,
    query: mockQuery,
  }));

  return {
    Pool: MockPool,
  };
});

// Mock @langchain/langgraph-checkpoint-postgres
vi.mock('@langchain/langgraph-checkpoint-postgres', () => {
  const mockSetup = vi.fn().mockResolvedValue(undefined);

  const MockPostgresSaver = {
    fromConnString: vi.fn().mockReturnValue({
      setup: mockSetup,
    }),
  };

  return {
    PostgresSaver: MockPostgresSaver,
  };
});

describe('checkpointer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

      // Verify Pool was created with correct defaults
      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          user: 'test_user',
          password: 'test_password',
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        })
      );
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

      // Verify Pool was created with custom configuration
      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'db.example.com',
          port: 5433,
          database: 'custom_db',
          user: 'custom_user',
          password: 'custom_password',
          max: 20,
          idleTimeoutMillis: 60000,
          connectionTimeoutMillis: 10000,
          ssl: true,
        })
      );
    });

    it('should test database connection', async () => {
      const config: CheckpointerConfig = {
        host: 'localhost',
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
      };

      await createCheckpointer(config);

      // Verify connection test was performed
      const poolInstance = vi.mocked(Pool).mock.results[0].value;
      expect(poolInstance.connect).toHaveBeenCalled();
    });

    it('should setup checkpoints table', async () => {
      const config: CheckpointerConfig = {
        host: 'localhost',
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
      };

      await createCheckpointer(config);

      // Verify PostgresSaver was created with connection string
      expect(PostgresSaver.fromConnString).toHaveBeenCalledWith(
        'postgresql://test_user:test_password@localhost:5432/test_db'
      );

      // Verify setup was called
      const checkpointer = vi.mocked(PostgresSaver.fromConnString).mock
        .results[0].value;
      expect(checkpointer.setup).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      // Mock connection failure
      vi.mocked(Pool).mockImplementationOnce(() => ({
        connect: vi.fn().mockRejectedValue(new Error('Connection failed')),
        end: vi.fn().mockResolvedValue(undefined),
        query: vi.fn(),
      }));

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
      const mockEnd = vi.fn().mockResolvedValue(undefined);

      // Mock setup failure
      vi.mocked(PostgresSaver.fromConnString).mockReturnValueOnce({
        setup: vi.fn().mockRejectedValue(new Error('Setup failed')),
      } as any);

      vi.mocked(Pool).mockImplementationOnce(() => ({
        connect: vi.fn().mockResolvedValue({
          query: vi.fn().mockResolvedValue({ rows: [] }),
          release: vi.fn(),
        }),
        end: mockEnd,
        query: vi.fn(),
      }));

      const config: CheckpointerConfig = {
        host: 'localhost',
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
      };

      await expect(createCheckpointer(config)).rejects.toThrow();

      // Verify pool was cleaned up
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

      await createCheckpointer(config);

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: sslConfig,
        })
      );
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

      // Verify pool.end was called
      expect(instance.pool.end).toHaveBeenCalled();
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

      // Verify pool.end was called
      expect(instance.pool.end).toHaveBeenCalled();
    });
  });

  describe('createCheckpointerFromEnv', () => {
    it('should create checkpointer from environment variables with defaults', async () => {
      process.env.POSTGRES_DB = 'env_db';
      process.env.POSTGRES_USER = 'env_user';
      process.env.POSTGRES_PASSWORD = 'env_password';

      const instance = await createCheckpointerFromEnv();

      expect(instance).toBeDefined();

      // Verify defaults were used
      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 5432,
          database: 'env_db',
          user: 'env_user',
          password: 'env_password',
          max: 10,
          ssl: false,
        })
      );
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

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'env-host.example.com',
          port: 5433,
          database: 'env_db',
          user: 'env_user',
          password: 'env_password',
          max: 20,
          ssl: true,
        })
      );
    });

    it('should throw error when required env vars are missing', async () => {
      // Only set some required variables
      process.env.POSTGRES_DB = 'env_db';
      process.env.POSTGRES_USER = 'env_user';
      // POSTGRES_PASSWORD is missing

      await expect(createCheckpointerFromEnv()).rejects.toThrow(
        'Missing required environment variables: POSTGRES_PASSWORD'
      );
    });

    it('should throw error when multiple required env vars are missing', async () => {
      // Set no required variables

      await expect(createCheckpointerFromEnv()).rejects.toThrow(
        'Missing required environment variables: POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD'
      );
    });

    it('should parse port as integer', async () => {
      process.env.POSTGRES_PORT = '9999';
      process.env.POSTGRES_DB = 'env_db';
      process.env.POSTGRES_USER = 'env_user';
      process.env.POSTGRES_PASSWORD = 'env_password';

      await createCheckpointerFromEnv();

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 9999,
        })
      );
    });

    it('should parse max connections as integer', async () => {
      process.env.POSTGRES_MAX_CONNECTIONS = '50';
      process.env.POSTGRES_DB = 'env_db';
      process.env.POSTGRES_USER = 'env_user';
      process.env.POSTGRES_PASSWORD = 'env_password';

      await createCheckpointerFromEnv();

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 50,
        })
      );
    });
  });
});
