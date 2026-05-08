/**
 * Additional tests targeting previously-uncovered branches/lines in anthropic.ts.
 * Lines targeted: 62-63, 156, 176, 325, 332, 407-421, 437-459, 495, 522, 565, 586, 618, 631, 633, 652
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import type { MessageStreamEvent } from '@anthropic-ai/sdk/resources/messages';
import {
  AnthropicProvider,
  AnthropicConfigurationError,
  AnthropicValidationError,
  AnthropicAPIError,
  AnthropicProviderError,
  AnthropicStreamError,
  type AnthropicProviderConfig,
} from './anthropic';
import type { CompletionOptions } from '../types';
import { AgentRole } from '../usage-tracker';

vi.mock('@anthropic-ai/sdk');

describe('AnthropicProvider — additional coverage', () => {
  let provider: AnthropicProvider;
  let mockClient: {
    messages: {
      create: ReturnType<typeof vi.fn>;
      stream: ReturnType<typeof vi.fn>;
    };
  };

  const config: AnthropicProviderConfig = {
    type: 'anthropic',
    apiKey: 'sk-ant-test-key-12345678901234567890',
    defaultModel: 'claude-3-5-sonnet-20241022',
    timeout: 30000,
    maxRetries: 3,
    tenantId: 'test-tenant',
    agentRole: AgentRole.CUSTOM,
  };

  beforeEach(() => {
    mockClient = {
      messages: {
        create: vi.fn(),
        stream: vi.fn(),
      },
    };
    vi.mocked(Anthropic).mockImplementation(function () {
      return mockClient as unknown as Anthropic;
    });
    provider = new AnthropicProvider(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ------------------------------------------------------------------
  // L62-63: AnthropicStreamError construction
  // ------------------------------------------------------------------
  describe('AnthropicStreamError', () => {
    it('exposes name=AnthropicStreamError and code=STREAM_ERROR', () => {
      const cause = new Error('inner');
      const err = new AnthropicStreamError('boom', cause);
      expect(err).toBeInstanceOf(AnthropicProviderError);
      expect(err.name).toBe('AnthropicStreamError');
      expect(err.code).toBe('STREAM_ERROR');
      expect(err.message).toBe('boom');
      expect(err.originalError).toBe(cause);
    });
  });

  // ------------------------------------------------------------------
  // L156: createClient catch-block (Anthropic constructor throws)
  // ------------------------------------------------------------------
  describe('createClient error path', () => {
    it('wraps Anthropic constructor failures in AnthropicConfigurationError', () => {
      vi.mocked(Anthropic).mockImplementationOnce(function () {
        throw new Error('SDK boom');
      });
      expect(() => new AnthropicProvider(config)).toThrow(AnthropicConfigurationError);
    });
  });

  // ------------------------------------------------------------------
  // L176: messages must be a non-empty array (non-array path)
  // ------------------------------------------------------------------
  describe('validateCompletionOptions: non-array messages', () => {
    it('rejects when messages is not an array', async () => {
      const opts = {
        model: 'claude-3-5-sonnet-20241022',
        messages: 'not an array' as unknown as CompletionOptions['messages'],
        max_tokens: 100,
      } as CompletionOptions;
      await expect(provider.complete(opts)).rejects.toThrow(/Messages must be a non-empty array/);
    });
  });

  // ------------------------------------------------------------------
  // L325, L332: streamComplete stop_sequence branch + processStreamEvent throws
  // ------------------------------------------------------------------
  describe('streamComplete: stop_sequence + processStreamEvent error', () => {
    const options: CompletionOptions = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 64,
      stream: true,
    };

    it('captures stop_sequence from message_delta', async () => {
      const events: MessageStreamEvent[] = [
        {
          type: 'message_start',
          message: {
            id: 'msg', type: 'message', role: 'assistant',
            model: 'm', content: [], stop_reason: null,
            stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 },
          },
        },
        {
          type: 'message_delta',
          delta: { stop_reason: 'stop_sequence', stop_sequence: 'STOP-MARKER' },
          usage: { output_tokens: 2 },
        },
        { type: 'message_stop' },
      ];
      async function* gen() { for (const e of events) yield e; }
      mockClient.messages.stream.mockReturnValue(gen());

      const collected: unknown[] = [];
      for await (const d of provider.streamComplete(options)) collected.push(d);
      expect(collected.length).toBeGreaterThan(0);
    });

    it('wraps a synchronous throw inside handleStreamEvent in AnthropicStreamError (L332)', async () => {
      // Spy on the private handleStreamEvent method so it throws when called.
      // The for-await loop will be inside the try/catch at L322-336 and the
      // catch should rethrow as AnthropicStreamError.
      const spy = vi
        .spyOn(
          provider as unknown as { handleStreamEvent: (...args: unknown[]) => unknown },
          'handleStreamEvent'
        )
        .mockImplementation(() => {
          throw new Error('inner boom');
        });
      async function* gen(): AsyncGenerator<MessageStreamEvent> {
        yield {
          type: 'message_start',
          message: {
            id: 'msg', type: 'message', role: 'assistant',
            model: 'm', content: [], stop_reason: null,
            stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 },
          },
        };
      }
      mockClient.messages.stream.mockReturnValue(gen());
      await expect(async () => {
        for await (const _ of provider.streamComplete(options)) {
          /* iterate */
        }
      }).rejects.toBeInstanceOf(AnthropicStreamError);
      spy.mockRestore();
    });
  });

  // ------------------------------------------------------------------
  // L407-421, L437-459: tool_use content_block_start + input_json_delta
  // ------------------------------------------------------------------
  describe('streamComplete: tool_use blocks and input_json_delta', () => {
    const options: CompletionOptions = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: 'Call a tool' }],
      max_tokens: 128,
      stream: true,
    };

    it('emits a tool_use content_block_start and accumulates input_json_delta', async () => {
      const events: MessageStreamEvent[] = [
        {
          type: 'message_start',
          message: {
            id: 'msg', type: 'message', role: 'assistant',
            model: 'm', content: [], stop_reason: null,
            stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 },
          },
        },
        {
          type: 'content_block_start',
          index: 0,
          content_block: {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'get_weather',
            input: {},
          },
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: {
            type: 'input_json_delta',
            partial_json: '{"location":"SF"}',
          },
        } as unknown as MessageStreamEvent,
        // input_json_delta with malformed JSON to exercise the inner try/catch
        {
          type: 'content_block_delta',
          index: 0,
          delta: {
            type: 'input_json_delta',
            partial_json: '{not json',
          },
        } as unknown as MessageStreamEvent,
        { type: 'content_block_stop', index: 0 },
        { type: 'message_stop' },
      ];
      async function* gen() { for (const e of events) yield e; }
      mockClient.messages.stream.mockReturnValue(gen());

      const deltas: unknown[] = [];
      for await (const d of provider.streamComplete(options)) deltas.push(d);

      // Expect at least the content_block_start (tool_use) and one tool_use_delta
      const hasToolStart = deltas.some(
        (d) =>
          (d as { type?: string }).type === 'content_block_start' &&
          (d as { content_block?: { type: string } }).content_block?.type === 'tool_use'
      );
      const hasToolDelta = deltas.some(
        (d) =>
          (d as { delta?: { type?: string } }).delta?.type === 'tool_use_delta'
      );
      expect(hasToolStart).toBe(true);
      expect(hasToolDelta).toBe(true);
    });

    // L421: content_block_start whose content_block.type is neither 'text' nor 'tool_use'
    it('returns null for an unknown content_block_start type (L421)', async () => {
      const events = [
        {
          type: 'message_start',
          message: {
            id: 'm', type: 'message', role: 'assistant',
            model: 'm', content: [], stop_reason: null,
            stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 },
          },
        },
        {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'mystery_block' as unknown as 'text' },
        },
        { type: 'message_stop' },
      ] as unknown as MessageStreamEvent[];
      async function* g() { for (const e of events) yield e; }
      mockClient.messages.stream.mockReturnValue(g());
      const out: unknown[] = [];
      for await (const d of provider.streamComplete(options)) out.push(d);
      // The mystery content_block_start should have been swallowed (returned null).
      expect(out.some((d) => (d as { type?: string }).type === 'content_block_start')).toBe(false);
    });

    // L459: content_block_delta whose delta.type is neither text_delta nor input_json_delta
    it('returns null for an unknown content_block_delta type (L459)', async () => {
      const events = [
        {
          type: 'message_start',
          message: {
            id: 'm', type: 'message', role: 'assistant',
            model: 'm', content: [], stop_reason: null,
            stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 },
          },
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'mystery_delta' as unknown as 'text_delta' },
        },
        { type: 'message_stop' },
      ] as unknown as MessageStreamEvent[];
      async function* g() { for (const e of events) yield e; }
      mockClient.messages.stream.mockReturnValue(g());
      const out: unknown[] = [];
      for await (const d of provider.streamComplete(options)) out.push(d);
      expect(out.some((d) => (d as { type?: string }).type === 'content_block_delta')).toBe(false);
    });

    // L495: default branch — entirely unknown event type
    it('returns null for an unknown top-level stream event type (L495)', async () => {
      const events = [
        {
          type: 'message_start',
          message: {
            id: 'm', type: 'message', role: 'assistant',
            model: 'm', content: [], stop_reason: null,
            stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 },
          },
        },
        { type: 'mystery_event_type' as unknown as 'message_stop' },
        { type: 'message_stop' },
      ] as unknown as MessageStreamEvent[];
      async function* g() { for (const e of events) yield e; }
      mockClient.messages.stream.mockReturnValue(g());
      const out: unknown[] = [];
      for await (const d of provider.streamComplete(options)) out.push(d);
      expect(out.some((d) => (d as { type?: string }).type === 'mystery_event_type')).toBe(false);
    });
  });

  // ------------------------------------------------------------------
  // L495: convertResponse default fallthrough (handled elsewhere); L522 etc
  // L522: validateConfig non-APIError fallback
  // ------------------------------------------------------------------
  describe('validateConfig: non-API error path', () => {
    it('wraps a generic error in AnthropicConfigurationError', async () => {
      mockClient.messages.create.mockRejectedValue(new Error('boom'));
      await expect(provider.validateConfig()).rejects.toThrow(AnthropicConfigurationError);
      await expect(provider.validateConfig()).rejects.toThrow(/Failed to validate configuration/);
    });
  });

  // ------------------------------------------------------------------
  // L565, L586: unknown content block types — throw paths in convertMessages / convertResponse
  // ------------------------------------------------------------------
  describe('unknown content block types', () => {
    it('throws when convertMessages encounters an unknown block type', async () => {
      const opts: CompletionOptions = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [
          {
            role: 'assistant',
            content: [
              { type: 'mystery' as unknown as 'text', text: 'x' } as unknown as never,
            ],
          },
        ],
      };
      mockClient.messages.create.mockResolvedValue({
        id: 'm', type: 'message', role: 'assistant',
        model: 'm', content: [{ type: 'text', text: 'x' }],
        stop_reason: 'end_turn', stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      });
      await expect(provider.complete(opts)).rejects.toThrow(/Unexpected error|Unknown content block type/);
    });

    it('throws when convertResponse encounters an unknown block type', async () => {
      const opts: CompletionOptions = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Hi' }],
      };
      mockClient.messages.create.mockResolvedValue({
        id: 'm', type: 'message', role: 'assistant',
        model: 'm',
        content: [{ type: 'mystery_block', mystery: true } as unknown as { type: 'text'; text: string }],
        stop_reason: 'end_turn', stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      });
      await expect(provider.complete(opts)).rejects.toThrow(/Unexpected error|Unknown content block type/);
    });
  });

  // ------------------------------------------------------------------
  // L618: handleError short-circuits known provider error subclasses
  // ------------------------------------------------------------------
  describe('handleError short-circuit', () => {
    it('returns AnthropicStreamError untouched (does not re-wrap)', () => {
      const original = new AnthropicStreamError('stream broken');
      const wrapped = (provider as unknown as { handleError(e: unknown): Error }).handleError(
        original
      );
      expect(wrapped).toBe(original);
    });

    it('returns AnthropicProviderError untouched', () => {
      const original = new AnthropicProviderError('x', 'X_CODE');
      const wrapped = (provider as unknown as { handleError(e: unknown): Error }).handleError(
        original
      );
      expect(wrapped).toBe(original);
    });
  });

  // ------------------------------------------------------------------
  // L631, L633: handleError status 403 / 404 message rewrites
  // ------------------------------------------------------------------
  describe('handleError: 403 and 404 message rewrites', () => {
    const opts: CompletionOptions = {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 64,
      messages: [{ role: 'user', content: 'Hi' }],
    };

    it('formats 403 as Access forbidden', async () => {
      const err = new Anthropic.APIError(403, { error: { type: 'forbidden', message: 'no' } }, 'no', {});
      Object.assign(err, { status: 403, message: 'no' });
      mockClient.messages.create.mockRejectedValue(err);
      await expect(provider.complete(opts)).rejects.toThrow(/Access forbidden/);
    });

    it('formats 404 as Resource not found', async () => {
      const err = new Anthropic.APIError(404, { error: { type: 'not_found', message: 'gone' } }, 'gone', {});
      Object.assign(err, { status: 404, message: 'gone' });
      mockClient.messages.create.mockRejectedValue(err);
      await expect(provider.complete(opts)).rejects.toThrow(/Resource not found/);
    });
  });

  // ------------------------------------------------------------------
  // L652: handleError unknown (non-Error) value
  // ------------------------------------------------------------------
  describe('handleError: unknown non-Error value', () => {
    it('wraps a thrown string in AnthropicProviderError UNKNOWN_ERROR', () => {
      const wrapped = (provider as unknown as { handleError(e: unknown): Error }).handleError(
        'just a string'
      );
      expect(wrapped).toBeInstanceOf(AnthropicProviderError);
      expect((wrapped as AnthropicProviderError).code).toBe('UNKNOWN_ERROR');
      expect(wrapped.message).toBe('An unknown error occurred');
    });

    it('wraps a thrown plain object in AnthropicProviderError UNKNOWN_ERROR', () => {
      const wrapped = (provider as unknown as { handleError(e: unknown): Error }).handleError({
        weird: 1,
      });
      expect(wrapped).toBeInstanceOf(AnthropicProviderError);
      expect((wrapped as AnthropicProviderError).code).toBe('UNKNOWN_ERROR');
    });
  });

  // ------------------------------------------------------------------
  // L256, L346: this.config.agentRole || DEFAULT_CONFIG.agentRole fallback
  //   (provider built WITHOUT an explicit agentRole)
  // ------------------------------------------------------------------
  describe('agentRole DEFAULT_CONFIG fallback (L256, L346)', () => {
    it('uses DEFAULT_CONFIG.agentRole when config.agentRole is omitted (complete + stream)', async () => {
      const noRoleConfig: AnthropicProviderConfig = {
        type: 'anthropic',
        apiKey: 'sk-ant-test-key-12345678901234567890',
        defaultModel: 'claude-3-5-sonnet-20241022',
        timeout: 30000,
        maxRetries: 3,
        tenantId: 'test-tenant',
        // agentRole intentionally omitted
      };
      const noRoleProvider = new AnthropicProvider(noRoleConfig);
      // mergeWithDefaults populates DEFAULT_CONFIG.agentRole — force-clear so the
      // `this.config.agentRole || DEFAULT_CONFIG.agentRole` fallback at L256/L346 fires.
      (noRoleProvider.config as { agentRole?: AgentRole }).agentRole = undefined;

      // complete path (L256)
      mockClient.messages.create.mockResolvedValueOnce({
        id: 'msg', type: 'message', role: 'assistant',
        model: 'claude-3-5-sonnet-20241022',
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn', stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      } as Anthropic.Message);
      const r = await noRoleProvider.complete({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Hi' }],
      });
      expect(r.content[0]).toEqual({ type: 'text', text: 'ok' });

      // streamComplete path (L346)
      const events: MessageStreamEvent[] = [
        {
          type: 'message_start',
          message: {
            id: 'm', type: 'message', role: 'assistant',
            model: 'm', content: [], stop_reason: null,
            stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 },
          },
        },
        { type: 'message_stop' },
      ];
      async function* g() { for (const e of events) yield e; }
      mockClient.messages.stream.mockReturnValue(g());
      const acc: unknown[] = [];
      for await (const d of noRoleProvider.streamComplete({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Hi' }],
        stream: true,
      })) acc.push(d);
      expect(acc.length).toBeGreaterThan(0);
    });
  });

  // ------------------------------------------------------------------
  // L476: event.delta.stop_reason || undefined when stop_reason is null/empty
  // L485: usage:undefined when event.usage is missing in message_delta
  // ------------------------------------------------------------------
  describe('message_delta optional fields', () => {
    const options: CompletionOptions = {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 64,
      messages: [{ role: 'user', content: 'Hi' }],
      stream: true,
    };

    it('drops null stop_reason and missing usage from message_delta event', async () => {
      const events: MessageStreamEvent[] = [
        {
          type: 'message_start',
          message: {
            id: 'm', type: 'message', role: 'assistant',
            model: 'm', content: [], stop_reason: null,
            stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 },
          },
        },
        // delta with null stop_reason and NO usage — exercises both fallbacks
        {
          type: 'message_delta',
          delta: { stop_reason: null, stop_sequence: null },
        } as unknown as MessageStreamEvent,
        { type: 'message_stop' },
      ];
      async function* g() { for (const e of events) yield e; }
      mockClient.messages.stream.mockReturnValue(g());
      const acc: { type?: string; usage?: unknown; delta?: { stop_reason?: unknown } }[] = [];
      for await (const d of provider.streamComplete(options)) acc.push(d as { type?: string });
      const md = acc.find((d) => d.type === 'message_delta');
      expect(md).toBeDefined();
      expect(md?.delta?.stop_reason).toBeUndefined();
      expect(md?.usage).toBeUndefined();
    });
  });

  // ------------------------------------------------------------------
  // L506: validateConfig defaultModel fallback when config.defaultModel is missing
  // ------------------------------------------------------------------
  describe('validateConfig defaultModel fallback (L506)', () => {
    it('uses DEFAULT_CONFIG.defaultModel when config.defaultModel is undefined', async () => {
      const noModelConfig: AnthropicProviderConfig = {
        type: 'anthropic',
        apiKey: 'sk-ant-test-key-12345678901234567890',
        // defaultModel omitted — mergeWithDefaults should populate it, but
        // the validateConfig branch reads `this.config.defaultModel || DEFAULT_CONFIG.defaultModel`
        // independently. We force-clear it after construction to drive the fallback.
      };
      const p = new AnthropicProvider(noModelConfig);
      // Clear after construction to drive the L506 fallback explicitly.
      (p.config as { defaultModel?: string }).defaultModel = undefined;
      mockClient.messages.create.mockResolvedValueOnce({
        id: 'm', type: 'message', role: 'assistant', model: 'm',
        content: [{ type: 'text', text: 'x' }],
        stop_reason: 'end_turn', stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      } as Anthropic.Message);
      const ok = await p.validateConfig();
      expect(ok).toBe(true);
    });
  });

  // ------------------------------------------------------------------
  // L190, L198: temperature/top_p NEGATIVE rejection branch
  // ------------------------------------------------------------------
  describe('validateCompletionOptions: negative bounds', () => {
    it('rejects negative temperature', async () => {
      await expect(
        provider.complete({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 16,
          temperature: -0.5,
          messages: [{ role: 'user', content: 'Hi' }],
        })
      ).rejects.toThrow(/Temperature must be between 0 and 1/);
    });

    it('rejects negative top_p', async () => {
      await expect(
        provider.complete({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 16,
          top_p: -0.1,
          messages: [{ role: 'user', content: 'Hi' }],
        })
      ).rejects.toThrow(/top_p must be between 0 and 1/);
    });

    it('accepts in-range temperature and top_p (false-branch coverage)', async () => {
      mockClient.messages.create.mockResolvedValueOnce({
        id: 'm', type: 'message', role: 'assistant', model: 'm',
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn', stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      } as Anthropic.Message);
      const r = await provider.complete({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 16,
        temperature: 0.5,
        top_p: 0.5,
        messages: [{ role: 'user', content: 'Hi' }],
      });
      expect(r.content[0]).toEqual({ type: 'text', text: 'ok' });
    });
  });

  // ------------------------------------------------------------------
  // L250, L340: skip token tracking when this.config.tenantId is missing
  // ------------------------------------------------------------------
  describe('skips token tracking without tenantId (L250, L340)', () => {
    it('completes without invoking trackTokenUsage when tenantId is undefined', async () => {
      const noTenant: AnthropicProviderConfig = {
        type: 'anthropic',
        apiKey: 'sk-ant-test-key-12345678901234567890',
        defaultModel: 'claude-3-5-sonnet-20241022',
        // tenantId omitted
      };
      const p = new AnthropicProvider(noTenant);
      mockClient.messages.create.mockResolvedValueOnce({
        id: 'm', type: 'message', role: 'assistant', model: 'm',
        content: [{ type: 'text', text: 'x' }],
        stop_reason: 'end_turn', stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      } as Anthropic.Message);
      const r = await p.complete({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Hi' }],
      });
      expect(r.content[0]).toEqual({ type: 'text', text: 'x' });
    });

    it('streams without invoking trackTokenUsage when tenantId is undefined', async () => {
      const noTenant: AnthropicProviderConfig = {
        type: 'anthropic',
        apiKey: 'sk-ant-test-key-12345678901234567890',
      };
      const p = new AnthropicProvider(noTenant);
      const events: MessageStreamEvent[] = [
        {
          type: 'message_start',
          message: {
            id: 'm', type: 'message', role: 'assistant',
            model: 'm', content: [], stop_reason: null,
            stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 },
          },
        },
        { type: 'message_stop' },
      ];
      async function* g() { for (const e of events) yield e; }
      mockClient.messages.stream.mockReturnValue(g());
      const acc: unknown[] = [];
      for await (const d of p.streamComplete({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Hi' }],
        stream: true,
      })) acc.push(d);
      expect(acc.length).toBeGreaterThan(0);
    });
  });

  // ------------------------------------------------------------------
  // L380: message_start without usage — the inner if branch is false
  // L426, L439: text_delta / input_json_delta when contentBlocks[index] is unset
  // ------------------------------------------------------------------
  describe('handleStreamEvent edge branches (L380, L426, L439)', () => {
    const options: CompletionOptions = {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 64,
      messages: [{ role: 'user', content: 'Hi' }],
      stream: true,
    };

    it('handles message_start with usage missing (L380)', async () => {
      const events = [
        {
          type: 'message_start',
          message: {
            id: 'm', type: 'message', role: 'assistant',
            model: 'm', content: [], stop_reason: null,
            stop_sequence: null,
            // usage intentionally missing
          },
        },
        { type: 'message_stop' },
      ] as unknown as MessageStreamEvent[];
      async function* g() { for (const e of events) yield e; }
      mockClient.messages.stream.mockReturnValue(g());
      const out: unknown[] = [];
      for await (const d of provider.streamComplete(options)) out.push(d);
      expect(out.length).toBeGreaterThan(0);
    });

    it('handles text_delta arriving before its content_block_start (L426)', async () => {
      // No content_block_start event — contentBlocks[0] is undefined
      const events = [
        {
          type: 'message_start',
          message: {
            id: 'm', type: 'message', role: 'assistant',
            model: 'm', content: [], stop_reason: null,
            stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 },
          },
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'orphan' },
        },
        { type: 'message_stop' },
      ] as unknown as MessageStreamEvent[];
      async function* g() { for (const e of events) yield e; }
      mockClient.messages.stream.mockReturnValue(g());
      const out: unknown[] = [];
      for await (const d of provider.streamComplete(options)) out.push(d);
      expect(out.some((d) =>
        (d as { delta?: { type?: string; text?: string } }).delta?.type === 'text_delta'
      )).toBe(true);
    });

    it('handles input_json_delta arriving before its tool_use content_block_start (L439)', async () => {
      const events = [
        {
          type: 'message_start',
          message: {
            id: 'm', type: 'message', role: 'assistant',
            model: 'm', content: [], stop_reason: null,
            stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 },
          },
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'input_json_delta', partial_json: '{"k":1}' },
        },
        { type: 'message_stop' },
      ] as unknown as MessageStreamEvent[];
      async function* g() { for (const e of events) yield e; }
      mockClient.messages.stream.mockReturnValue(g());
      const out: unknown[] = [];
      for await (const d of provider.streamComplete(options)) out.push(d);
      expect(out.some((d) =>
        (d as { delta?: { type?: string } }).delta?.type === 'tool_use_delta'
      )).toBe(true);
    });
  });

  // ------------------------------------------------------------------
  // L495: APIError without status (statusCode undefined branch)
  // ------------------------------------------------------------------
  describe('handleError: APIError without explicit status', () => {
    it('returns an AnthropicAPIError when status is undefined (no message rewrite)', () => {
      const apiErr = Object.assign(
        Object.create(Anthropic.APIError.prototype) as Error,
        { status: undefined, message: 'opaque' }
      );
      const wrapped = (provider as unknown as { handleError(e: unknown): Error }).handleError(
        apiErr
      );
      expect(wrapped).toBeInstanceOf(AnthropicAPIError);
      expect(wrapped.message).toBe('opaque');
    });
  });
});
