/**
 * @file aep-preview-host entry — wires the express app factory to an
 * actual HTTP listener and schedules the expired-preview sweeper.
 * Pure logic lives in `app.ts` so tests can drive it without sockets.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { createServer } from 'http';
import { createPreviewApp, sweepExpiredPreviews } from './app';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT
  ? Number(process.env.PORT)
  : process.env.AEP_PREVIEW_HOST_PORT
    ? Number(process.env.AEP_PREVIEW_HOST_PORT)
    : 46001;

const { app, activePreviews } = createPreviewApp({ host, port });
const server = createServer(app);

// Cleanup expired previews every minute.
setInterval(() => sweepExpiredPreviews(activePreviews), 60_000);

server.listen(port, host, () => {
  console.log(`[ ready ] http://${host}:${port}`);
});
