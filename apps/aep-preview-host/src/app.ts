/**
 * @file aep-preview-host Express app factory — extracted from main.ts so
 * tests can mount it without booting an HTTP listener.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import express, { Express } from 'express';

export interface PreviewRecord {
  projectId: string;
  tenantId: string;
  status: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface CreatePreviewBody {
  projectId: string;
  tenantId: string;
  mode?: string;
  durationMinutes?: number;
}

export interface PreviewAppOptions {
  host: string;
  port: number;
}

/**
 * Build an Express app with the preview CRUD + render routes.
 * Returns both the app and the in-memory store (for tests + the cleanup
 * timer in main.ts).
 */
export function createPreviewApp(options: PreviewAppOptions): {
  app: Express;
  activePreviews: Map<string, PreviewRecord>;
} {
  const { host, port } = options;
  const app = express();
  app.use(express.json());

  const activePreviews = new Map<string, PreviewRecord>();

  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      activePreviews: activePreviews.size,
    });
  });

  app.get('/api/previews', (_req, res) => {
    const previews = Array.from(activePreviews.entries()).map(([id, data]) => ({
      id,
      ...data,
    }));
    res.json({ previews, total: previews.length });
  });

  app.post('/api/previews', (req, res) => {
    const { projectId, tenantId, mode, durationMinutes } =
      req.body as CreatePreviewBody;
    const previewId = `preview_${Date.now()}`;
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + (durationMinutes || 30) * 60 * 1000,
    );

    activePreviews.set(previewId, {
      projectId,
      tenantId,
      status: 'running',
      createdAt: now,
      expiresAt,
    });

    res.status(201).json({
      previewId,
      previewUrl: `http://${host}:${port}/preview/${previewId}`,
      mode: mode || 'mock',
      status: 'running',
      expiresAt: expiresAt.toISOString(),
    });
  });

  app.get('/api/previews/:id', (req, res) => {
    const preview = activePreviews.get(req.params.id);
    if (!preview) {
      res.status(404).json({ error: 'Preview not found' });
      return;
    }
    res.json({ id: req.params.id, ...preview });
  });

  app.delete('/api/previews/:id', (req, res) => {
    if (!activePreviews.has(req.params.id)) {
      res.status(404).json({ error: 'Preview not found' });
      return;
    }
    activePreviews.delete(req.params.id);
    res.json({ message: 'Preview stopped', previewId: req.params.id });
  });

  app.get('/preview/:id', (req, res) => {
    const preview = activePreviews.get(req.params.id);
    if (!preview) {
      res
        .status(404)
        .send('<html><body><h1>Preview not found</h1></body></html>');
      return;
    }
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Preview - ${preview.projectId}</title>
      <style>
        body { font-family: Inter, sans-serif; margin: 0; padding: 24px; background: #f5f5f5; }
        .preview-banner { background: #12174c; color: white; padding: 12px 24px; border-radius: 8px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
        .preview-banner small { color: rgba(255,255,255,0.7); }
        .preview-content { background: white; border-radius: 8px; padding: 48px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .preview-content h2 { color: #12174c; }
        .preview-content p { color: #59585a; }
      </style>
    </head>
    <body>
      <div class="preview-banner">
        <span>Preview Mode</span>
        <small>Project: ${preview.projectId} | Expires: ${preview.expiresAt.toISOString()}</small>
      </div>
      <div class="preview-content">
        <h2>Generated Application Preview</h2>
        <p>The AI-generated application will render here once code generation is complete.</p>
      </div>
    </body>
    </html>
  `);
  });

  return { app, activePreviews };
}

/**
 * Sweep expired previews from the in-memory store. Called on an interval
 * by main.ts; pure so tests can drive it deterministically.
 */
export function sweepExpiredPreviews(
  store: Map<string, PreviewRecord>,
  now = new Date(),
): number {
  let removed = 0;
  for (const [id, preview] of store.entries()) {
    if (preview.expiresAt < now) {
      store.delete(id);
      removed += 1;
    }
  }
  return removed;
}
