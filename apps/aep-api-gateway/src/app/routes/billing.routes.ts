import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Billing and usage routes
 * Base path: /api/v1/billing
 * All routes require JWT authentication
 */
export default async function billingRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/billing/usage
   * Get current billing period usage
   * Protected by JWT middleware
   */
  fastify.get<{ Querystring: { period?: string } }>(
    '/api/v1/billing/usage',
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: 'Get billing usage for current period',
        tags: ['billing'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            period: {
              type: 'string',
              enum: ['current', 'previous', 'ytd'],
              default: 'current',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              period: {
                type: 'object',
                properties: {
                  start: { type: 'string' },
                  end: { type: 'string' },
                },
              },
              plan: {
                type: 'object',
                properties: {
                  tier: { type: 'string' },
                  monthlyFee: { type: 'number' },
                  currency: { type: 'string' },
                },
              },
              usage: {
                type: 'object',
                properties: {
                  apiCalls: {
                    type: 'object',
                    properties: {
                      northbound: { type: 'number' },
                      events: { type: 'number' },
                      qoe: { type: 'number' },
                      total: { type: 'number' },
                      limit: { type: 'number' },
                      overageRate: { type: 'number' },
                    },
                  },
                  aiSessions: {
                    type: 'object',
                    properties: {
                      count: { type: 'number' },
                      limit: { type: 'number' },
                      llmTokens: {
                        type: 'object',
                        properties: {
                          claude: { type: 'number' },
                          ollama: { type: 'number' },
                        },
                      },
                    },
                  },
                  previewMinutes: { type: 'number' },
                  publishes: { type: 'number' },
                  thirdPartyIngestion: {
                    type: 'object',
                    properties: {
                      mqtt: {
                        type: 'object',
                        properties: {
                          messages: { type: 'number' },
                          rate: { type: 'number' },
                        },
                      },
                      http: {
                        type: 'object',
                        properties: {
                          requests: { type: 'number' },
                          rate: { type: 'number' },
                        },
                      },
                      storage: {
                        type: 'object',
                        properties: {
                          gigabytes: { type: 'number' },
                          rate: { type: 'number' },
                        },
                      },
                    },
                  },
                },
              },
              charges: {
                type: 'object',
                properties: {
                  baseFee: { type: 'number' },
                  apiOverage: { type: 'number' },
                  thirdPartyIngestion: { type: 'number' },
                  total: { type: 'number' },
                  currency: { type: 'string' },
                },
              },
              alerts: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    metric: { type: 'string' },
                    threshold: { type: 'number' },
                    current: { type: 'number' },
                    severity: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest<{ Querystring: { period?: string } }>, reply: FastifyReply) => {
      // TODO: Integrate with billing-service (libs/core/billing-service)
      // 1. Get tenant from JWT payload
      // 2. Retrieve current billing period (monthly cycle)
      // 3. Query usage events from Redis Streams
      // 4. Aggregate by metric type:
      //    - API calls per source (Northbound/Events/QoE)
      //    - AI sessions + LLM token usage (Claude vs Ollama)
      //    - Preview minutes
      //    - Publishes
      //    - Third-party ingestion:
      //      * MQTT: $0.01/1k (Pro), $0.005/1k (Ent)
      //      * HTTP: $0.02/1k (Pro), $0.01/1k (Ent)
      //      * Storage: $0.10/GB (Pro), $0.05/GB (Ent)
      // 5. Calculate charges:
      //    - Base fee: $499/$2,499/$7,999
      //    - Overage rates per tier
      // 6. Check threshold alerts (80%/95%)
      // 7. Note: Ollama tokens metered at $0 but tracked

      // Stub response for Pro tier
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      return reply.status(200).send({
        period: {
          start: periodStart.toISOString(),
          end: periodEnd.toISOString(),
        },
        plan: {
          tier: 'pro',
          monthlyFee: 2499,
          currency: 'USD',
        },
        usage: {
          apiCalls: {
            northbound: 450000,
            events: 320000,
            qoe: 180000,
            total: 950000,
            limit: 2000000,
            overageRate: 0.015,
          },
          aiSessions: {
            count: 287,
            limit: 500,
            llmTokens: {
              claude: 1250000,
              ollama: 0,
            },
          },
          previewMinutes: 450,
          publishes: 42,
          thirdPartyIngestion: {
            mqtt: {
              messages: 125000,
              rate: 0.01,
            },
            http: {
              requests: 45000,
              rate: 0.02,
            },
            storage: {
              gigabytes: 12.5,
              rate: 0.1,
            },
          },
        },
        charges: {
          baseFee: 2499,
          apiOverage: 0,
          thirdPartyIngestion: 3.45,
          total: 2502.45,
          currency: 'USD',
        },
        alerts: [
          {
            metric: 'apiCalls',
            threshold: 80,
            current: 47.5,
            severity: 'info',
          },
        ],
      });
    }
  );
}
