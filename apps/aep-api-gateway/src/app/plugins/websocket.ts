import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import websocket from '@fastify/websocket';

/**
 * Configures WebSocket support for agent chat and preview streaming
 *
 * @see https://github.com/fastify/fastify-websocket
 */
export default fp(async function (fastify: FastifyInstance) {
  fastify.register(websocket, {
    options: {
      // Maximum payload size (10MB)
      maxPayload: 10 * 1024 * 1024,
      // Client tracking
      clientTracking: true,
      // Compression options
      perMessageDeflate: {
        zlibDeflateOptions: {
          chunkSize: 1024,
          memLevel: 7,
          level: 3,
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024,
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
        concurrencyLimit: 10,
        threshold: 1024,
      },
      // Heartbeat configuration
      skipUTF8Validation: false,
      // Verify client origin
      verifyClient: (info, callback) => {
        // Allow all origins in development
        if (process.env.NODE_ENV === 'development') {
          callback(true);
          return;
        }

        // Verify origin in production
        const allowedOrigins = [
          process.env.CORS_ORIGIN_BUILDER || 'http://localhost:4200',
          process.env.CORS_ORIGIN_PREVIEW || 'http://localhost:4201',
          process.env.CORS_ORIGIN_ADMIN || 'http://localhost:4202',
        ];

        const origin = info.origin || info.req.headers.origin;
        if (origin && allowedOrigins.includes(origin)) {
          callback(true);
        } else {
          callback(false, 403, 'Forbidden');
        }
      },
    },
  });

  fastify.log.info('WebSocket plugin configured for agent chat and preview streaming');

  // Add WebSocket connection tracking
  const connections = new Map<string, Set<any>>();

  // Helper to track connections by tenant
  fastify.decorate('wsConnections', {
    add: (tenantId: string, connection: any) => {
      if (!connections.has(tenantId)) {
        connections.set(tenantId, new Set());
      }
      connections.get(tenantId)?.add(connection);
      fastify.log.debug({ tenantId, total: connections.get(tenantId)?.size }, 'WebSocket connection added');
    },
    remove: (tenantId: string, connection: any) => {
      const tenantConnections = connections.get(tenantId);
      if (tenantConnections) {
        tenantConnections.delete(connection);
        if (tenantConnections.size === 0) {
          connections.delete(tenantId);
        }
      }
      fastify.log.debug({ tenantId, total: connections.get(tenantId)?.size || 0 }, 'WebSocket connection removed');
    },
    getByTenant: (tenantId: string) => {
      return Array.from(connections.get(tenantId) || []);
    },
    count: (tenantId?: string) => {
      if (tenantId) {
        return connections.get(tenantId)?.size || 0;
      }
      let total = 0;
      connections.forEach((conns) => (total += conns.size));
      return total;
    },
  });

  // Log connection stats periodically
  if (process.env.NODE_ENV !== 'test') {
    setInterval(() => {
      const stats = {
        totalTenants: connections.size,
        totalConnections: (fastify as any).wsConnections.count(),
      };
      if (stats.totalConnections > 0) {
        fastify.log.debug(stats, 'WebSocket connection stats');
      }
    }, 60000); // Every minute
  }
});

// Extend Fastify type definitions
declare module 'fastify' {
  interface FastifyInstance {
    wsConnections: {
      add: (tenantId: string, connection: any) => void;
      remove: (tenantId: string, connection: any) => void;
      getByTenant: (tenantId: string) => any[];
      count: (tenantId?: string) => number;
    };
  }
}
