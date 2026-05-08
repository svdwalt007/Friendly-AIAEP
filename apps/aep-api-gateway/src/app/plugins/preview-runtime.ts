import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';

interface StubPreviewRuntime {
  launchPreview(opts: Record<string, unknown>): Promise<Record<string, unknown>>;
  getPreviewStatus(id: string): Promise<Record<string, unknown> | null>;
  stopPreview(id: string): Promise<void>;
  listActiveSessions(tenantId: string): Promise<{ sessions: unknown[]; total: number; usage: unknown }>;
  shutdown(): Promise<void>;
}

export default fp(async function (fastify: FastifyInstance) {
  let previewRuntime: StubPreviewRuntime;

  try {
    const mod = await import('@friendly-tech/builder/preview-runtime');
    if (mod.PreviewRuntimeService) {
      const service = new mod.PreviewRuntimeService({
        dockerOptions: {
          socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock',
        },
        cleanupIntervalMinutes: 5,
        enableHotReload: true,
        sourcesBasePath: './dist/generated',
        previewUrlPattern: 'local',
      });
      await service.initialize();
      previewRuntime = service as unknown as StubPreviewRuntime;
      fastify.log.info('Preview Runtime Service initialized');
    } else {
      throw new Error('PreviewRuntimeService not available');
    }
  } catch (err) {
    fastify.log.warn({ err }, 'Preview Runtime Service not available, using stub');

    const sessions = new Map<string, Record<string, unknown>>();

    previewRuntime = {
      async launchPreview(opts: Record<string, unknown>) {
        const sessionId = `preview_${Date.now()}`;
        const session = {
          sessionId,
          previewUrl: `http://localhost:46001/preview/${sessionId}`,
          mode: opts['mode'] || 'mock',
          status: 'running',
          expiresAt: new Date(Date.now() + ((opts['durationMinutes'] as number) || 30) * 60_000),
        };
        sessions.set(sessionId, session);
        return session;
      },
      async getPreviewStatus(id: string) {
        const session = sessions.get(id);
        if (!session) return null;
        return {
          sessionId: id,
          previewUrl: session['previewUrl'],
          status: session['status'],
          ttl: Math.max(0, (session['expiresAt'] as Date).getTime() - Date.now()),
          timestamp: new Date(),
        };
      },
      async stopPreview(id: string) {
        sessions.delete(id);
      },
      async listActiveSessions(_tenantId: string) {
        const list = Array.from(sessions.entries()).map(([id, s]) => ({ id, ...s }));
        return { sessions: list, total: list.length, usage: { current: list.length, limit: 10 } };
      },
      async shutdown() {
        sessions.clear();
      },
    };
  }

  fastify.decorate('previewRuntime', previewRuntime);

  fastify.addHook('onClose', async () => {
    await previewRuntime.shutdown();
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    previewRuntime: StubPreviewRuntime;
  }
}
