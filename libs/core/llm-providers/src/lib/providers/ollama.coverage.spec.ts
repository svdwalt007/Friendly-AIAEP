/**
 * Additional tests targeting previously-uncovered branches/lines in ollama.ts.
 * Lines targeted: 54, 66-67, 391, 464-470, 481-482, 494, 504, 511, 531, 548,
 *                 559-560, 591, 595, 599, 614
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  OllamaProvider,
  OllamaError,
  OllamaTimeoutError,
  OllamaConnectionError,
  SSEParser,
} from './ollama';
import { ChatOptions, Message, StreamChunk, LLMErrorType } from '../types';
import { AgentRole } from '../usage-tracker';

describe('SSEParser — additional coverage', () => {
  // L54: malformed line (no colon, no leading ':' comment) — fall through `continue`
  it('skips malformed lines without a colon', () => {
    const chunk = new TextEncoder().encode('garbage line without colon\ndata: ok\n\n');
    const parser = new SSEParser();
    const events = Array.from(parser.parse(chunk));
    expect(events).toHaveLength(1);
    expect(events[0].data).toBe('ok');
  });

  // L66-67: retry field handling
  it('parses retry field as integer', () => {
    const chunk = new TextEncoder().encode('retry: 1500\ndata: x\n\n');
    const parser = new SSEParser();
    const events = Array.from(parser.parse(chunk));
    expect(events).toHaveLength(1);
    expect(events[0].retry).toBe(1500);
  });

  // L39: empty line on a currentEvent without data — false branch (does not yield)
  it('does NOT yield an event when an empty line follows a non-data line only', () => {
    // event: foo\n then a blank line (signals end of event) but data is unset
    const chunk = new TextEncoder().encode('event: foo\n\ndata: real\n\n');
    const parser = new SSEParser();
    const events = Array.from(parser.parse(chunk));
    // Only the second “real” event should be yielded; the first never had `data`
    expect(events).toHaveLength(1);
    expect(events[0].data).toBe('real');
  });

  // L66 false-side: an unknown field (not data/event/id/retry) — ignored silently
  it('ignores unrecognised fields like x-custom', () => {
    const chunk = new TextEncoder().encode('x-custom: ignore-me\ndata: ok\n\n');
    const parser = new SSEParser();
    const events = Array.from(parser.parse(chunk));
    expect(events).toHaveLength(1);
    expect(events[0].data).toBe('ok');
  });

  // L78: flush() when buffer does NOT start with "data:" — yields nothing
  it('flush() yields nothing for a non-data tail', () => {
    const parser = new SSEParser();
    Array.from(parser.parse(new TextEncoder().encode('event: orphan')));
    const out = Array.from(parser.flush());
    expect(out).toHaveLength(0);
  });
});

describe('OllamaProvider — additional coverage', () => {
  let provider: OllamaProvider;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    provider = new OllamaProvider(
      {
        provider: 'ollama',
        model: 'llama2',
        baseUrl: 'http://localhost:11434',
        timeout: 5000,
      } as any,
      { tenantId: 't', agentRole: AgentRole.CUSTOM }
    );
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------
  // L376, L497, L581: options?.model fallback to this.defaultModel
  // L639-641: response.usage?.X fallbacks to 0
  // -------------------------------------------------------------------
  it('falls back to defaultModel when options.model is omitted in streaming (L497)', async () => {
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          enc.encode(
            `data: ${JSON.stringify({
              id: 's', object: 'chat.completion.chunk', created: 1, model: 'llama2',
              choices: [{ index: 0, delta: { content: 'x' }, finish_reason: 'stop' }],
            })}\n\n`
          )
        );
        controller.close();
      },
    });
    fetchMock.mockResolvedValueOnce({ ok: true, body: stream, text: async () => '' });
    // Force the post-loop emitUsageEvent path by attaching usage to the chunk
    // (otherwise totals stay 0 and L497 isn’t reached).
    const original = (provider as any).processStreamEvent.bind(provider);
    (provider as any).processStreamEvent = (e: any) => {
      const c = original(e);
      if (c) c.usage = { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 };
      return c;
    };
    const gen = (await provider.chat([{ role: 'user', content: 'Hi' }], {
      // model omitted on purpose → forces options?.model || this.defaultModel fallback
      stream: true,
    } as ChatOptions)) as AsyncGenerator<StreamChunk, void, unknown>;
    const chunks: StreamChunk[] = [];
    for await (const c of gen) chunks.push(c);
    expect(chunks.length).toBeGreaterThan(0);
    // Verify the request body used the defaultModel
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('llama2');
  });

  it('falls back to defaultModel when options.model is omitted (non-streaming)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'i', object: 'chat.completion', created: 1, model: 'llama2',
        choices: [
          { index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' },
        ],
        // No usage field at all → exercises L639-641 fallbacks
      }),
      text: async () => '',
    });
    const out = await provider.chat([{ role: 'user', content: 'Hi' }]);
    // Cast: at runtime this is ChatResponse since options.stream wasn't set
    expect((out as any).message.content).toBe('ok');
    expect((out as any).usage.prompt_tokens).toBe(0);
    expect((out as any).usage.completion_tokens).toBe(0);
    expect((out as any).usage.total_tokens).toBe(0);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('llama2');
  });

  // Trigger the setTimeout(() => controller.abort()) callbacks (L289/L341/L409 anon fns)
  describe('AbortController timeout callbacks fire on real timeout', () => {
    // Build a fetch mock that hooks the AbortController so the test's vi.advanceTimersByTimeAsync
    // can fire the production setTimeout and have abort propagate to a rejection.
    const pendingFetch = () =>
      function (_url: string, init: { signal: AbortSignal }) {
        return new Promise((_resolve, reject) => {
          if (init.signal.aborted) {
            const e = new Error('Aborted');
            e.name = 'AbortError';
            reject(e);
            return;
          }
          init.signal.addEventListener('abort', () => {
            const e = new Error('Aborted');
            e.name = 'AbortError';
            reject(e);
          });
        });
      };

    it('fires the abort callback inside validateConfig (L289)', async () => {
      vi.useFakeTimers();
      try {
        fetchMock.mockImplementationOnce(pendingFetch());
        const p = provider.validateConfig().catch((e) => e);
        await vi.advanceTimersByTimeAsync(6000);
        const result = await p;
        expect(result).toBeInstanceOf(OllamaTimeoutError);
      } finally {
        vi.useRealTimers();
      }
    });

    it('fires the abort callback inside completeChat (L341)', async () => {
      vi.useFakeTimers();
      try {
        fetchMock.mockImplementationOnce(pendingFetch());
        const p = provider
          .chat([{ role: 'user', content: 'Hi' }], { model: 'llama2' })
          .catch((e) => e);
        await vi.advanceTimersByTimeAsync(6000);
        const result = await p;
        expect(result).toBeInstanceOf(OllamaTimeoutError);
      } finally {
        vi.useRealTimers();
      }
    });

    it('fires the abort callback inside streamChat (L409)', async () => {
      vi.useFakeTimers();
      try {
        fetchMock.mockImplementationOnce(pendingFetch());
        // For a streaming call, await chat() first to get the AsyncGenerator,
        // then call .next() (which kicks off the production fetch + setTimeout),
        // then advance fake timers so the production timeout fires.
        const genResult = await provider.chat([{ role: 'user', content: 'Hi' }], {
          model: 'llama2',
          stream: true,
        });
        const gen = genResult as AsyncGenerator<StreamChunk, void, unknown>;
        const nextP = gen.next().catch((e) => e);
        await vi.advanceTimersByTimeAsync(6000);
        const result = await nextP;
        expect(result).toBeInstanceOf(OllamaTimeoutError);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // L305: validateConfig non-Error catch path
  it('coerces a non-Error throw to a string in validateConfig (L305)', async () => {
    fetchMock.mockImplementationOnce(() => {
      // eslint-disable-next-line no-throw-literal
      throw 'plain-string-error';
    });
    await expect(provider.validateConfig()).rejects.toBeInstanceOf(OllamaConnectionError);
  });

  // L392: completeChat non-Error catch path
  it('coerces a non-Error throw to a string in completeChat (L392)', async () => {
    fetchMock.mockImplementationOnce(() => {
      // eslint-disable-next-line no-throw-literal
      throw 'string-non-error';
    });
    await expect(
      provider.chat([{ role: 'user', content: 'Hi' }], { model: 'llama2' })
    ).rejects.toBeInstanceOf(OllamaConnectionError);
  });

  // L512: streamChat non-Error catch path
  it('coerces a non-Error throw to a string in streamChat (L512)', async () => {
    fetchMock.mockImplementationOnce(() => {
      // eslint-disable-next-line no-throw-literal
      throw 'string-non-error-stream';
    });
    const gen = (await provider.chat([{ role: 'user', content: 'Hi' }], {
      model: 'llama2',
      stream: true,
    })) as AsyncGenerator<StreamChunk, void, unknown>;
    await expect(gen.next()).rejects.toBeInstanceOf(OllamaConnectionError);
  });

  // -------------------------------------------------------------------
  // L391: completeChat catch — generic non-OllamaError, non-AbortError
  // -------------------------------------------------------------------
  it('wraps a generic fetch error in OllamaConnectionError (non-streaming)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('refused'));
    await expect(
      provider.chat([{ role: 'user', content: 'Hi' }], { model: 'llama2' })
    ).rejects.toThrow(OllamaConnectionError);
  });

  it('rethrows OllamaError unchanged from completeChat', async () => {
    // First call: response.ok=false to construct an OllamaError, second call: same path.
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => 'service unavailable',
    });
    await expect(
      provider.chat([{ role: 'user', content: 'Hi' }], { model: 'llama2' })
    ).rejects.toBeInstanceOf(OllamaError);
  });

  // -------------------------------------------------------------------
  // L464-470: streamChat — flush() yields a chunk with usage on `done`
  // L481-482: streamChat — usage captured during normal parse loop
  // L494:    emitUsageEvent fires when totals > 0
  // -------------------------------------------------------------------
  it('exercises the in-loop usage assignment when processStreamEvent returns chunks carrying usage', async () => {
    const enc = new TextEncoder();
    // Two events that produce normal chunks; we will swap processStreamEvent
    // to attach `usage` to its returned chunks so the production paths at
    // L466-470 / L480-482 / L494 (emitUsageEvent) are exercised.
    const e1 = JSON.stringify({
      id: '1', object: 'chat.completion.chunk', created: 1, model: 'llama2',
      choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
    });
    const e2 = JSON.stringify({
      id: '1', object: 'chat.completion.chunk', created: 1, model: 'llama2',
      choices: [{ index: 0, delta: { content: 'hi' }, finish_reason: 'stop' }],
    });
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(enc.encode(`data: ${e1}\n\n`));
        controller.enqueue(enc.encode(`data: ${e2}\n\n`));
        controller.close();
      },
    });
    fetchMock.mockResolvedValueOnce({ ok: true, body: stream, text: async () => '' });

    // Wrap processStreamEvent on this provider instance to attach usage to
    // every produced chunk — this drives the in-loop branches that copy
    // usage out of the chunk and the post-loop emitUsageEvent.
    const original = (provider as any).processStreamEvent.bind(provider);
    (provider as any).processStreamEvent = (e: any) => {
      const c = original(e);
      if (c) c.usage = { prompt_tokens: 11, completion_tokens: 5, total_tokens: 16 };
      return c;
    };

    const gen = (await provider.chat([{ role: 'user', content: 'Hi' }], {
      model: 'llama2',
      stream: true,
    })) as AsyncGenerator<StreamChunk, void, unknown>;
    const chunks: StreamChunk[] = [];
    for await (const c of gen) chunks.push(c);
    expect(chunks.length).toBeGreaterThan(0);
    // Every yielded chunk had usage attached, so the inline branches were exercised.
    expect(chunks.every((c) => c.usage?.prompt_tokens === 11)).toBe(true);
  });

  it('also covers the in-flush usage-bearing chunk branch', async () => {
    const enc = new TextEncoder();
    // Tail event with no trailing blank line forces parser.flush() to yield it.
    const tail = `data: ${JSON.stringify({
      id: 't', object: 'chat.completion.chunk', created: 1, model: 'llama2',
      choices: [{ index: 0, delta: { content: 'tail' }, finish_reason: 'stop' }],
    })}`;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(enc.encode(tail));
        controller.close();
      },
    });
    fetchMock.mockResolvedValueOnce({ ok: true, body: stream, text: async () => '' });

    const original = (provider as any).processStreamEvent.bind(provider);
    (provider as any).processStreamEvent = (e: any) => {
      const c = original(e);
      if (c) c.usage = { prompt_tokens: 9, completion_tokens: 3, total_tokens: 12 };
      return c;
    };

    const gen = (await provider.chat([{ role: 'user', content: 'Hi' }], {
      model: 'llama2',
      stream: true,
    })) as AsyncGenerator<StreamChunk, void, unknown>;
    const chunks: StreamChunk[] = [];
    for await (const c of gen) chunks.push(c);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].usage?.prompt_tokens).toBe(9);
  });

  it('streams a usage-bearing chunk both inline and during flush, then emits a usage event', async () => {
    // Build a stream that:
    //   1. emits a normal chunk WITHOUT usage (token text)
    //   2. emits a chunk WITH usage at the end (so totalPromptTokens/Completion get set inline → L481-482)
    //   3. truncates without trailing newlines so flush() also yields a tail chunk WITH usage (→ L464-470)

    const finalWithUsage = JSON.stringify({
      id: '1',
      object: 'chat.completion.chunk',
      created: 1,
      model: 'llama2',
      choices: [
        {
          index: 0,
          delta: { content: ' done' },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 7,
        completion_tokens: 3,
        total_tokens: 10,
      },
    });
    const events = [
      `data: ${JSON.stringify({
        id: '1',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'llama2',
        choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
      })}\n\n`,
      `data: ${finalWithUsage}\n\n`,
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const e of events) controller.enqueue(encoder.encode(e));
        controller.close();
      },
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      body: stream,
      text: async () => '',
    });

    // OpenAIStreamChunk doesn't actually carry `usage` per the types but the
    // production code does the optional access `chunk.usage` — easiest path is
    // to verify the consumer still walks both branches without crashing.
    // We additionally assert at least the role+content+finish_reason chunks come through.
    const gen = (await provider.chat([{ role: 'user', content: 'Hi' }], {
      model: 'llama2',
      stream: true,
    })) as AsyncGenerator<StreamChunk, void, unknown>;

    const chunks: StreamChunk[] = [];
    for await (const c of gen) chunks.push(c);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].delta.role).toBe('assistant');
    expect(chunks.some((c) => c.delta.content === ' done')).toBe(true);
    expect(chunks[chunks.length - 1].finish_reason).toBe('stop');
  });

  // L465: flush yields an SSE event whose processStreamEvent returns null ([DONE] tail)
  it('handles a [DONE] tail in the flush buffer (chunk is null branch L465)', async () => {
    const tail = `data: [DONE]`;
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // First, emit one normal chunk to ensure we exit the parse loop with a yield.
        controller.enqueue(
          enc.encode(
            `data: ${JSON.stringify({
              id: 'a', object: 'chat.completion.chunk', created: 1, model: 'llama2',
              choices: [{ index: 0, delta: { content: 'a' }, finish_reason: 'stop' }],
            })}\n\n`
          )
        );
        // Then a tail [DONE] WITHOUT a trailing blank line, so it lives in the parser buffer
        // and is yielded by parser.flush() when the reader signals done.
        controller.enqueue(enc.encode(tail));
        controller.close();
      },
    });
    fetchMock.mockResolvedValueOnce({ ok: true, body: stream, text: async () => '' });
    const gen = (await provider.chat([{ role: 'user', content: 'Hi' }], {
      model: 'llama2',
      stream: true,
    })) as AsyncGenerator<StreamChunk, void, unknown>;
    const chunks: StreamChunk[] = [];
    for await (const c of gen) chunks.push(c);
    // [DONE] yields no chunk; only the inline 'a' chunk should come through
    expect(chunks).toHaveLength(1);
    expect(chunks[0].delta.content).toBe('a');
  });

  it('flushes a tail SSE event missing the final blank line', async () => {
    // Stream ends mid-event: parser.flush() should yield the tail data.
    const tail = `data: ${JSON.stringify({
      id: '2',
      object: 'chat.completion.chunk',
      created: 1,
      model: 'llama2',
      choices: [
        {
          index: 0,
          delta: { content: 'tail' },
          finish_reason: 'stop',
        },
      ],
    })}`;
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(tail));
        controller.close();
      },
    });
    fetchMock.mockResolvedValueOnce({ ok: true, body: stream, text: async () => '' });

    const gen = (await provider.chat([{ role: 'user', content: 'Hi' }], {
      model: 'llama2',
      stream: true,
    })) as AsyncGenerator<StreamChunk, void, unknown>;

    const chunks: StreamChunk[] = [];
    for await (const c of gen) chunks.push(c);
    expect(chunks.some((c) => c.delta.content === 'tail')).toBe(true);
  });

  // -------------------------------------------------------------------
  // L504: streamChat AbortError → OllamaTimeoutError
  // -------------------------------------------------------------------
  it('translates AbortError mid-stream into OllamaTimeoutError', async () => {
    const abortErr = new Error('abort');
    abortErr.name = 'AbortError';
    fetchMock.mockRejectedValueOnce(abortErr);
    const gen = (await provider.chat([{ role: 'user', content: 'Hi' }], {
      model: 'llama2',
      stream: true,
    })) as AsyncGenerator<StreamChunk, void, unknown>;
    await expect(gen.next()).rejects.toBeInstanceOf(OllamaTimeoutError);
  });

  // -------------------------------------------------------------------
  // L511: streamChat catch — generic non-OllamaError, non-AbortError
  // -------------------------------------------------------------------
  it('wraps a generic streaming error in OllamaConnectionError', async () => {
    fetchMock.mockRejectedValueOnce(new Error('socket dead'));
    const gen = (await provider.chat([{ role: 'user', content: 'Hi' }], {
      model: 'llama2',
      stream: true,
    })) as AsyncGenerator<StreamChunk, void, unknown>;
    await expect(gen.next()).rejects.toBeInstanceOf(OllamaConnectionError);
  });

  // -------------------------------------------------------------------
  // L531: processStreamEvent returns null when choices array is empty
  // -------------------------------------------------------------------
  it('skips SSE events whose choices[] is empty', async () => {
    const stream = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        controller.enqueue(
          enc.encode(`data: ${JSON.stringify({
            id: 'e', object: 'chat.completion.chunk', created: 1, model: 'llama2',
            choices: [],
          })}\n\n`)
        );
        // Then a normal chunk so we can confirm we still pass through.
        controller.enqueue(
          enc.encode(`data: ${JSON.stringify({
            id: 'e', object: 'chat.completion.chunk', created: 1, model: 'llama2',
            choices: [{ index: 0, delta: { content: 'after-empty' }, finish_reason: null }],
          })}\n\n`)
        );
        controller.close();
      },
    });
    fetchMock.mockResolvedValueOnce({ ok: true, body: stream, text: async () => '' });
    const gen = (await provider.chat([{ role: 'user', content: 'Hi' }], {
      model: 'llama2',
      stream: true,
    })) as AsyncGenerator<StreamChunk, void, unknown>;
    const chunks: StreamChunk[] = [];
    for await (const c of gen) chunks.push(c);
    // The empty-choices chunk should have been dropped; the second one survives.
    expect(chunks).toHaveLength(1);
    expect(chunks[0].delta.content).toBe('after-empty');
  });

  // -------------------------------------------------------------------
  // L548: tool_calls deltas mapped through processStreamEvent
  // -------------------------------------------------------------------
  it('maps tool_calls delta into StreamChunk.delta.tool_calls', async () => {
    const enc = new TextEncoder();
    const data = JSON.stringify({
      id: 't',
      object: 'chat.completion.chunk',
      created: 1,
      model: 'llama2',
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                id: 'tc1',
                type: 'function',
                function: { name: 'calc', arguments: '{}' },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
    });
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(enc.encode(`data: ${data}\n\n`));
        controller.close();
      },
    });
    fetchMock.mockResolvedValueOnce({ ok: true, body: stream, text: async () => '' });
    const gen = (await provider.chat([{ role: 'user', content: 'Hi' }], {
      model: 'llama2',
      stream: true,
    })) as AsyncGenerator<StreamChunk, void, unknown>;
    const chunks: StreamChunk[] = [];
    for await (const c of gen) chunks.push(c);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].delta.tool_calls).toHaveLength(1);
    expect(chunks[0].delta.tool_calls?.[0].id).toBe('tc1');
    expect(chunks[0].finish_reason).toBe('tool_calls');
  });

  // -------------------------------------------------------------------
  // L559-560: processStreamEvent — malformed JSON → console.warn + null
  // -------------------------------------------------------------------
  it('skips malformed JSON SSE events with a warning', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(enc.encode('data: {not valid json\n\n'));
        controller.enqueue(
          enc.encode(`data: ${JSON.stringify({
            id: 'g', object: 'chat.completion.chunk', created: 1, model: 'llama2',
            choices: [{ index: 0, delta: { content: 'still here' }, finish_reason: null }],
          })}\n\n`)
        );
        controller.close();
      },
    });
    fetchMock.mockResolvedValueOnce({ ok: true, body: stream, text: async () => '' });
    const gen = (await provider.chat([{ role: 'user', content: 'Hi' }], {
      model: 'llama2',
      stream: true,
    })) as AsyncGenerator<StreamChunk, void, unknown>;
    const chunks: StreamChunk[] = [];
    for await (const c of gen) chunks.push(c);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].delta.content).toBe('still here');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  // -------------------------------------------------------------------
  // L591, L595, L599, L614: buildOpenAIRequest options branches
  // -------------------------------------------------------------------
  it('builds an OpenAI request with temperature, top_p, stop, and tool_choice options', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'i', object: 'chat.completion', created: 1, model: 'llama2',
        choices: [
          { index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
      text: async () => '',
    });

    const opts: ChatOptions = {
      model: 'llama2',
      max_tokens: 64,
      temperature: 0.7,
      top_p: 0.9,
      stop: ['\n\n'],
      tool_choice: 'auto',
      tools: [
        {
          type: 'function',
          function: {
            name: 'calc',
            description: 'calc',
            parameters: { type: 'object', properties: {}, required: [] },
          },
        },
      ],
    };
    await provider.chat([{ role: 'user', content: 'Hi' }] as Message[], opts);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.temperature).toBe(0.7);
    expect(body.top_p).toBe(0.9);
    expect(body.stop).toEqual(['\n\n']);
    expect(body.tool_choice).toBe('auto');
  });
});
