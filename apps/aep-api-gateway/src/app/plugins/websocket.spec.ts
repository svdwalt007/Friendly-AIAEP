/**
 * @file websocket plugin — verifies the `wsConnections` tracking decorator
 * exposed on the Fastify instance: add / remove / getByTenant / count
 * across one or many tenants.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import websocketPlugin from './websocket';

describe('plugins/websocket — wsConnections decorator', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test'; // avoid the 60s stats-log interval
    app = Fastify({ logger: false });
    await app.register(websocketPlugin);
    await app.ready();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('exposes the wsConnections decorator with the documented surface', () => {
    expect(app.wsConnections).toBeDefined();
    expect(typeof app.wsConnections.add).toBe('function');
    expect(typeof app.wsConnections.remove).toBe('function');
    expect(typeof app.wsConnections.getByTenant).toBe('function');
    expect(typeof app.wsConnections.count).toBe('function');
  });

  it('count() starts at 0 with no connections registered', () => {
    expect(app.wsConnections.count()).toBe(0);
    expect(app.wsConnections.count('tnt-x')).toBe(0);
  });

  it('add() registers a connection against its tenant', () => {
    const conn = { id: 'c1' };
    app.wsConnections.add('tnt-1', conn);
    expect(app.wsConnections.count()).toBe(1);
    expect(app.wsConnections.count('tnt-1')).toBe(1);
    expect(app.wsConnections.getByTenant('tnt-1')).toEqual([conn]);
  });

  it('tracks multiple connections per tenant + multiple tenants separately', () => {
    app.wsConnections.add('tnt-1', { id: 'a' });
    app.wsConnections.add('tnt-1', { id: 'b' });
    app.wsConnections.add('tnt-2', { id: 'c' });

    expect(app.wsConnections.count()).toBe(3);
    expect(app.wsConnections.count('tnt-1')).toBe(2);
    expect(app.wsConnections.count('tnt-2')).toBe(1);
    expect(app.wsConnections.getByTenant('tnt-1').length).toBe(2);
  });

  it('remove() drops a single connection but preserves the rest', () => {
    const a = { id: 'a' };
    const b = { id: 'b' };
    app.wsConnections.add('tnt-1', a);
    app.wsConnections.add('tnt-1', b);

    app.wsConnections.remove('tnt-1', a);
    expect(app.wsConnections.count('tnt-1')).toBe(1);
    expect(app.wsConnections.getByTenant('tnt-1')).toEqual([b]);
  });

  it('remove() of the last connection deletes the tenant key from the map', () => {
    const conn = { id: 'only' };
    app.wsConnections.add('tnt-9', conn);
    app.wsConnections.remove('tnt-9', conn);
    expect(app.wsConnections.count('tnt-9')).toBe(0);
    expect(app.wsConnections.getByTenant('tnt-9')).toEqual([]);
  });

  it('remove() is a no-op for an unknown tenant', () => {
    expect(() =>
      app.wsConnections.remove('tnt-never', { id: 'x' }),
    ).not.toThrow();
    expect(app.wsConnections.count()).toBe(0);
  });

  it('getByTenant returns [] for an unknown tenant', () => {
    expect(app.wsConnections.getByTenant('tnt-zzz')).toEqual([]);
  });
});
