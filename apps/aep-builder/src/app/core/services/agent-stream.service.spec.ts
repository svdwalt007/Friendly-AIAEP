/**
 * @file AgentStreamService unit tests — exercises connect/disconnect/send
 * + every branch of handleMessage via a fake WebSocket installed on the
 * global before each test.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentStreamService } from './agent-stream.service';
import { AuthService } from './auth.service';

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];

  readyState = 0;
  url: string;
  sent: string[] = [];
  onopen: ((this: WebSocket, ev: Event) => unknown) | null = null;
  onmessage: ((this: WebSocket, ev: MessageEvent) => unknown) | null = null;
  onclose: ((this: WebSocket, ev: CloseEvent) => unknown) | null = null;
  onerror: ((this: WebSocket, ev: Event) => unknown) | null = null;
  closeCalls = 0;

  constructor(url: string | URL) {
    this.url = String(url);
    FakeWebSocket.instances.push(this);
  }

  send(payload: string): void {
    this.sent.push(payload);
  }

  close(): void {
    this.closeCalls += 1;
    this.readyState = 3;
    this.onclose?.call(this as unknown as WebSocket, new CloseEvent('close'));
  }

  // Test helpers.
  _open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.call(this as unknown as WebSocket, new Event('open'));
  }
  _message(data: unknown) {
    this.onmessage?.call(
      this as unknown as WebSocket,
      { data: typeof data === 'string' ? data : JSON.stringify(data) } as MessageEvent,
    );
  }
  _error() {
    this.onerror?.call(this as unknown as WebSocket, new Event('error'));
  }
}

describe('AgentStreamService', () => {
  let svc: AgentStreamService;
  let originalWS: typeof WebSocket;

  beforeEach(() => {
    originalWS = globalThis.WebSocket;
    FakeWebSocket.instances = [];
    Object.defineProperty(globalThis, 'WebSocket', {
      value: FakeWebSocket,
      configurable: true,
      writable: true,
    });

    TestBed.configureTestingModule({
      providers: [
        AgentStreamService,
        {
          provide: AuthService,
          useValue: { getToken: vi.fn(() => 'tok-1') },
        },
      ],
    });
    svc = TestBed.inject(AgentStreamService);
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'WebSocket', {
      value: originalWS,
      configurable: true,
      writable: true,
    });
  });

  it('starts with empty messages and disconnected state', () => {
    expect(svc.messages()).toEqual([]);
    expect(svc.connected()).toBe(false);
    expect(svc.streaming()).toBe(false);
  });

  it('connect() opens a ws:// URL containing the session id and the token', () => {
    svc.connect('sess-9');
    const ws = FakeWebSocket.instances[0];
    expect(ws).toBeTruthy();
    expect(ws.url).toContain('sessionId=sess-9');
    expect(ws.url).toContain('token=tok-1');
    expect(ws.url.startsWith('ws')).toBe(true);
  });

  it('connect() is a no-op when no auth token is present', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AgentStreamService,
        { provide: AuthService, useValue: { getToken: () => null } },
      ],
    });
    const sansToken = TestBed.inject(AgentStreamService);
    sansToken.connect('sess-x');
    expect(FakeWebSocket.instances.length).toBe(0);
  });

  it('onopen flips connected to true', () => {
    svc.connect('s');
    FakeWebSocket.instances[0]._open();
    expect(svc.connected()).toBe(true);
  });

  it('onclose flips connected and streaming back to false', () => {
    svc.connect('s');
    const ws = FakeWebSocket.instances[0];
    ws._open();
    expect(svc.connected()).toBe(true);
    ws.close();
    expect(svc.connected()).toBe(false);
    expect(svc.streaming()).toBe(false);
  });

  it('onerror flips connected to false', () => {
    svc.connect('s');
    const ws = FakeWebSocket.instances[0];
    ws._open();
    ws._error();
    expect(svc.connected()).toBe(false);
  });

  it('handleMessage(agent_thinking) sets streaming=true; with done=true sets it false', () => {
    svc.connect('s');
    const ws = FakeWebSocket.instances[0];
    ws._open();
    ws._message({ type: 'agent_thinking', content: '…', done: false });
    expect(svc.streaming()).toBe(true);
    ws._message({ type: 'agent_thinking', content: '…', done: true });
    expect(svc.streaming()).toBe(false);
  });

  it('handleMessage(complete) and (error) both set streaming=false', () => {
    svc.connect('s');
    const ws = FakeWebSocket.instances[0];
    ws._open();
    ws._message({ type: 'agent_response', done: false });
    expect(svc.streaming()).toBe(true);
    ws._message({ type: 'complete', content: 'done' });
    expect(svc.streaming()).toBe(false);

    ws._message({ type: 'agent_response', done: false });
    expect(svc.streaming()).toBe(true);
    ws._message({ type: 'error', content: 'boom' });
    expect(svc.streaming()).toBe(false);
  });

  it('handleMessage accepts the legacy `message` field as content', () => {
    svc.connect('s');
    const ws = FakeWebSocket.instances[0];
    ws._open();
    ws._message({ type: 'agent_response', message: 'legacy field' });
    const messages = svc.messages();
    expect(messages[messages.length - 1].content).toBe('legacy field');
  });

  it('silently ignores invalid JSON payloads', () => {
    svc.connect('s');
    const ws = FakeWebSocket.instances[0];
    ws._open();
    expect(() => ws._message('not-json{')).not.toThrow();
    expect(svc.messages()).toEqual([]);
  });

  it('sendMessage records the user message and forwards to the socket when open', () => {
    svc.connect('s');
    const ws = FakeWebSocket.instances[0];
    ws._open();
    svc.sendMessage('hello');

    expect(svc.messages().some((m) => m.type === 'user' && m.content === 'hello')).toBe(true);
    expect(ws.sent).toEqual([JSON.stringify({ type: 'message', content: 'hello' })]);
  });

  it('sendMessage still records the user message when the socket is not open', () => {
    svc.connect('s');
    const ws = FakeWebSocket.instances[0];
    // never opened
    svc.sendMessage('queued');
    expect(svc.messages().some((m) => m.content === 'queued')).toBe(true);
    expect(ws.sent).toEqual([]);
  });

  it('disconnect closes the socket and resets state', () => {
    svc.connect('s');
    const ws = FakeWebSocket.instances[0];
    ws._open();
    svc.disconnect();
    expect(ws.closeCalls).toBeGreaterThan(0);
    expect(svc.connected()).toBe(false);
    expect(svc.streaming()).toBe(false);
  });

  it('disconnect is safe to call when no socket exists', () => {
    expect(() => svc.disconnect()).not.toThrow();
    expect(svc.connected()).toBe(false);
  });

  it('clearMessages empties the message buffer', () => {
    svc.connect('s');
    const ws = FakeWebSocket.instances[0];
    ws._open();
    svc.sendMessage('a');
    svc.sendMessage('b');
    expect(svc.messages().length).toBe(2);
    svc.clearMessages();
    expect(svc.messages()).toEqual([]);
  });
});
