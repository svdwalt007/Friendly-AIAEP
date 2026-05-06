// @ts-nocheck - TODO: Fix pg module types and process.env index signature issues
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { Pool, PoolConfig } from 'pg';

/**
 * Configuration options for the PostgreSQL checkpointer
 */
export interface CheckpointerConfig {
  /** PostgreSQL host */
  host: string;
  /** PostgreSQL port (default: 5432) */
  port?: number;
  /** Database name */
  database: string;
  /** Database user */
  user: string;
  /** Database password */
  password: string;
  /** Maximum number of clients in the pool (default: 10) */
  maxConnections?: number;
  /** Milliseconds a client must sit idle before being released (default: 30000) */
  idleTimeoutMillis?: number;
  /** Milliseconds before timing out when connecting a new client (default: 5000) */
  connectionTimeoutMillis?: number;
  /** SSL configuration (optional) */
  ssl?: boolean | object;
}

/**
 * Checkpointer instance with cleanup capability
 */
export interface CheckpointerInstance {
  /** The PostgreSQL checkpointer for LangGraph */
  checkpointer: PostgresSaver;
  /** Connection pool for direct access if needed */
  pool: Pool;
  /** Cleanup function to close the pool and release resources */
  close: () => Promise<void>;
}

/**
 * Creates a PostgreSQL checkpointer for LangGraph state persistence
 *
 * @param config - Database connection configuration
 * @returns Configured checkpointer instance with cleanup function
 * @throws Error if connection fails or table setup fails
 *
 * @example
 * ```typescript
 * const checkpointer = await createCheckpointer({
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'aep_dev',
 *   user: 'postgres',
 *   password: 'postgres',
 *   maxConnections: 20,
 * });
 *
 * // Use with StateGraph
 * const graph = new StateGraph<AEPAgentState>({
 *   channels: stateChannels,
 * })
 *   .addNode('supervisor', supervisorNode)
 *   .addNode('planning', planningNode)
 *   .compile({
 *     checkpointer: checkpointer.checkpointer,
 *   });
 *
 * // Cleanup on shutdown
 * await checkpointer.close();
 * ```
 */
export async function createCheckpointer(
  config: CheckpointerConfig
): Promise<CheckpointerInstance> {
  // Build pool configuration with defaults
  const poolConfig: PoolConfig = {
    host: config.host,
    port: config.port ?? 5432,
    database: config.database,
    user: config.user,
    password: config.password,
    max: config.maxConnections ?? 10,
    idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
    connectionTimeoutMillis: config.connectionTimeoutMillis ?? 5000,
  };

  // Add SSL configuration if provided
  if (config.ssl !== undefined) {
    poolConfig.ssl = config.ssl;
  }

  let pool: Pool | null = null;
  let checkpointer: PostgresSaver | null = null;

  try {
    // Create PostgreSQL connection pool
    pool = new Pool(poolConfig);

    // Test connection
    const client = await pool.connect();
    try {
      await client.query('SELECT NOW()');
    } finally {
      client.release();
    }

    // Initialize PostgreSQL checkpointer
    checkpointer = PostgresSaver.fromConnString(
      `postgresql://${config.user}:${config.password}@${config.host}:${poolConfig.port}/${config.database}`
    );

    // Setup the checkpoints table if it doesn't exist
    await checkpointer.setup();

    // Create cleanup function
    const close = async (): Promise<void> => {
      if (pool) {
        await pool.end();
      }
    };

    return {
      checkpointer,
      pool,
      close,
    };
  } catch (error) {
    // Cleanup on error
    if (pool) {
      await pool.end();
    }

    if (error instanceof Error) {
      throw new Error(
        `Failed to create PostgreSQL checkpointer: ${error.message}`
      );
    }
    throw new Error('Failed to create PostgreSQL checkpointer: Unknown error');
  }
}

/**
 * Closes a checkpointer instance and releases all resources
 *
 * @param instance - The checkpointer instance to close
 *
 * @example
 * ```typescript
 * const checkpointer = await createCheckpointer(config);
 *
 * // ... use checkpointer ...
 *
 * // Cleanup
 * await closeCheckpointer(checkpointer);
 * ```
 */
export async function closeCheckpointer(
  instance: CheckpointerInstance
): Promise<void> {
  await instance.close();
}

/**
 * Creates a checkpointer from environment variables
 *
 * Expected environment variables:
 * - POSTGRES_HOST (default: 'localhost')
 * - POSTGRES_PORT (default: '5432')
 * - POSTGRES_DB (required)
 * - POSTGRES_USER (required)
 * - POSTGRES_PASSWORD (required)
 * - POSTGRES_MAX_CONNECTIONS (default: '10')
 * - POSTGRES_SSL (default: 'false')
 *
 * @returns Configured checkpointer instance
 * @throws Error if required environment variables are missing
 *
 * @example
 * ```typescript
 * // Set environment variables first
 * process.env.POSTGRES_DB = 'aep_dev';
 * process.env.POSTGRES_USER = 'postgres';
 * process.env.POSTGRES_PASSWORD = 'postgres';
 *
 * const checkpointer = await createCheckpointerFromEnv();
 * ```
 */
export async function createCheckpointerFromEnv(): Promise<CheckpointerInstance> {
  const requiredVars = ['POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD'];
  const missing = requiredVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  const config: CheckpointerConfig = {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: process.env.POSTGRES_PORT
      ? parseInt(process.env.POSTGRES_PORT, 10)
      : 5432,
    database: process.env.POSTGRES_DB!,
    user: process.env.POSTGRES_USER!,
    password: process.env.POSTGRES_PASSWORD!,
    maxConnections: process.env.POSTGRES_MAX_CONNECTIONS
      ? parseInt(process.env.POSTGRES_MAX_CONNECTIONS, 10)
      : 10,
    ssl: process.env.POSTGRES_SSL === 'true',
  };

  return createCheckpointer(config);
}
