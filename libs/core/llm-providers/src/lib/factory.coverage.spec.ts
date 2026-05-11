/**
 * Additional tests targeting previously-uncovered branches/lines in factory.ts.
 * Lines targeted: 241, 416, 569, 601, 621-623, 673
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getProvider,
  resolveLLMConfig,
  validateConfig,
  clearProviderCache,
  onProviderEvent,
  getConfigSummary,
  getDefaultConfig,
  executeWithFallback,
} from './factory';
import { AgentRole } from './usage-tracker';
import type { TenantLLMConfig, ProviderEvent } from './types';
import { AnthropicProvider } from './providers/anthropic';
import { OllamaProvider } from './providers/ollama';

vi.mock('./providers/anthropic');
vi.mock('./providers/ollama');

describe('factory — additional coverage', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearProviderCache();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // -------------------------------------------------------------------
  // L241: emitEvent listener throws → console.error
  // -------------------------------------------------------------------
  describe('event listener error swallowing', () => {
    it('logs to console.error when a listener throws', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const off = onProviderEvent(() => {
        throw new Error('listener boom');
      });
      try {
        // Trigger a provider creation event by calling getProvider once
        getProvider(AgentRole.CODEGEN);
        expect(errorSpy).toHaveBeenCalled();
        // The first call argument should mention the listener error
        expect(errorSpy.mock.calls[0][0]).toMatch(/Error in provider event listener/);
      } finally {
        off();
        errorSpy.mockRestore();
      }
    });
  });

  // -------------------------------------------------------------------
  // L416: createProviderInstance — `Unsupported provider type` throw
  // -------------------------------------------------------------------
  describe('createProviderInstance: unsupported provider type', () => {
    it('throws when config resolves to a provider that is neither anthropic nor ollama', () => {
      const tenantConfig = {
        tenantId: 'x',
        defaultConfig: {
          provider: 'mystery-provider' as unknown as 'anthropic',
          model: 'm',
        },
      } as unknown as TenantLLMConfig;
      expect(() => getProvider(AgentRole.CODEGEN, tenantConfig)).toThrow(
        /Unsupported provider type/
      );
    });
  });

  // -------------------------------------------------------------------
  // L569: validateConfig — invalid provider type error path
  // -------------------------------------------------------------------
  describe('validateConfig: invalid provider', () => {
    it('flags an unknown provider type as an error', async () => {
      const tenantConfig: TenantLLMConfig = {
        tenantId: 'x',
        defaultConfig: {
          provider: 'mystery' as unknown as 'anthropic',
          model: 'm',
        },
      };
      const result = await validateConfig(AgentRole.CODEGEN, tenantConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => /Invalid provider type/.test(e))).toBe(true);
    });

    it('flags a missing provider as an error (L569)', async () => {
      const tenantConfig: TenantLLMConfig = {
        tenantId: 'x',
        defaultConfig: {
          provider: '' as unknown as 'anthropic',
          model: 'm',
        },
      };
      const result = await validateConfig(AgentRole.CODEGEN, tenantConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => /Provider type is required/.test(e))).toBe(true);
    });
  });

  // -------------------------------------------------------------------
  // L601: validateConfig — fallbackModel without fallbackProvider warning
  // -------------------------------------------------------------------
  describe('validateConfig: fallbackModel without fallbackProvider', () => {
    it('emits a warning when fallbackModel is set but fallbackProvider is missing', async () => {
      const tenantConfig: TenantLLMConfig = {
        tenantId: 'x',
        defaultConfig: {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          fallbackModel: 'orphan-model',
          // explicitly clear any default fallbackProvider
          fallbackProvider: undefined,
        },
      };
      const result = await validateConfig(AgentRole.CODEGEN, tenantConfig);
      expect(
        result.warnings.some((w) => /fallbackModel specified without fallbackProvider/.test(w))
      ).toBe(true);
    });
  });

  // -------------------------------------------------------------------
  // L621-623: validateConfig outer catch (resolveLLMConfig throws)
  // -------------------------------------------------------------------
  describe('validateConfig: catches outer resolution errors', () => {
    it('returns a validation error when resolveLLMConfig throws', async () => {
      // resolveLLMConfig accesses tenantConfig.roleOverrides[agentRole] — make
      // that a getter that throws so the outer try/catch fires.
      const evil: TenantLLMConfig = { tenantId: 'x' };
      Object.defineProperty(evil, 'roleOverrides', {
        get() {
          throw new Error('roleOverrides exploded');
        },
      });
      const result = await validateConfig(AgentRole.CODEGEN, evil);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => /Configuration validation error/.test(e))
      ).toBe(true);
    });
  });

  // -------------------------------------------------------------------
  // L673: getConfigSummary — tenantConfig.roleOverrides[agentRole] path
  // -------------------------------------------------------------------
  describe('getConfigSummary: roleOverrides applied', () => {
    it('merges role-specific overrides into the tenantOverrides summary', () => {
      const tenantConfig: TenantLLMConfig = {
        tenantId: 't',
        defaultConfig: { maxTokens: 1024 },
        roleOverrides: {
          [AgentRole.CODEGEN]: { temperature: 0.42, maxTokens: 9001 },
        } as unknown as TenantLLMConfig['roleOverrides'],
      };
      const summary = getConfigSummary(AgentRole.CODEGEN, tenantConfig);
      expect(summary.tenantOverrides.temperature).toBe(0.42);
      // The role override wins over defaultConfig for the same key
      expect(summary.tenantOverrides.maxTokens).toBe(9001);
      expect(summary.resolvedConfig.temperature).toBe(0.42);
    });
  });

  // -------------------------------------------------------------------
  // L332 / L642: AGENT_LLM_MAP fallback to DEFAULT_LLM_CONFIG when role is unknown
  // -------------------------------------------------------------------
  describe('AGENT_LLM_MAP fallback to DEFAULT_LLM_CONFIG', () => {
    it('uses DEFAULT_LLM_CONFIG when the role is not in AGENT_LLM_MAP (resolveLLMConfig)', () => {
      const cfg = resolveLLMConfig('UNKNOWN_ROLE' as AgentRole);
      expect(cfg.provider).toBe('anthropic');
      expect(cfg.model).toBeTruthy();
    });

    it('uses DEFAULT_LLM_CONFIG when the role is not in AGENT_LLM_MAP (getDefaultConfig)', () => {
      const cfg = getDefaultConfig('UNKNOWN_ROLE' as AgentRole);
      expect(cfg.provider).toBe('anthropic');
      expect(cfg.model).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------
  // L393: process.env['ANTHROPIC_API_KEY'] || '' when the env var is unset
  // L397, L400: parseInt env override branches for timeout / maxRetries
  // L411: parseInt env override branch for OLLAMA_TIMEOUT
  // -------------------------------------------------------------------
  describe('createProviderInstance env-var fallbacks', () => {
    it('builds Anthropic config with env-var ANTHROPIC_TIMEOUT and ANTHROPIC_MAX_RETRIES', () => {
      delete process.env['ANTHROPIC_API_KEY'];
      process.env['ANTHROPIC_TIMEOUT'] = '12345';
      process.env['ANTHROPIC_MAX_RETRIES'] = '7';
      const provider = getProvider(AgentRole.CODEGEN);
      expect(provider).toBeDefined();
      // The Anthropic constructor should have been called with the parsed values
      const ctor = AnthropicProvider as unknown as { mock: { calls: unknown[][] } };
      const lastCall = ctor.mock.calls[ctor.mock.calls.length - 1][0] as {
        timeout?: number;
        maxRetries?: number;
        apiKey?: string;
      };
      expect(lastCall.timeout).toBe(12345);
      expect(lastCall.maxRetries).toBe(7);
      // ANTHROPIC_API_KEY missing → fallback to ''
      expect(lastCall.apiKey).toBe('');
    });

    it('builds Ollama config with env-var OLLAMA_TIMEOUT', () => {
      process.env['OLLAMA_TIMEOUT'] = '4321';
      // Use a tenant override that picks Ollama for the codegen role
      const provider = getProvider(AgentRole.CODEGEN, {
        tenantId: 't',
        defaultConfig: { provider: 'ollama', model: 'llama2' },
      });
      expect(provider).toBeDefined();
      const ctor = OllamaProvider as unknown as { mock: { calls: unknown[][] } };
      const lastCall = ctor.mock.calls[ctor.mock.calls.length - 1][0] as { timeout?: number };
      expect(lastCall.timeout).toBe(4321);
    });
  });

  // -------------------------------------------------------------------
  // L510, L536, L610, L621: error message extraction for non-Error throws
  // -------------------------------------------------------------------
  describe('non-Error error coercion in error-handling paths', () => {
    it('coerces a non-Error primary failure to a string message in executeWithFallback (L510)', async () => {
      // No fallback configured — the catch path still runs and rethrows.
      const events: ProviderEvent[] = [];
      const off = onProviderEvent((e) => events.push(e));
      try {
        await expect(
          executeWithFallback(AgentRole.CODEGEN, async () => {
            throw 'bare-string-error';
          })
        ).rejects.toBe('bare-string-error');
        // The error event should have used String(primaryError) (L510)
        expect(events.some((e) => e.eventType === 'error' && /bare-string-error/.test(e.message))).toBe(true);
      } finally {
        off();
      }
    });

    it('coerces a non-Error fallback failure to a string message in executeWithFallback (L536)', async () => {
      const events: ProviderEvent[] = [];
      const off = onProviderEvent((e) => events.push(e));
      try {
        await expect(
          executeWithFallback(
            AgentRole.CODEGEN,
            async () => {
              // Both primary AND fallback throw non-Error values.
              throw 'primary-string-fail';
            },
            {
              tenantId: 't',
              defaultConfig: {
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20241022',
                fallbackProvider: 'ollama',
                fallbackModel: 'llama2',
              },
            }
          )
        ).rejects.toBe('primary-string-fail');
        // primary error event records the string
        expect(events.some((e) => e.eventType === 'error')).toBe(true);
      } finally {
        off();
      }
    });

    it('coerces both primary AND fallback non-Error throws (L510 + L536)', async () => {
      let calls = 0;
      await expect(
        executeWithFallback(
          AgentRole.CODEGEN,
          async () => {
            calls += 1;
            // Throw bare strings on every call so both code paths run.
            // eslint-disable-next-line no-throw-literal
            throw `boom-${calls}`;
          },
          {
            tenantId: 't',
            defaultConfig: {
              provider: 'anthropic',
              model: 'claude-3-5-sonnet-20241022',
              fallbackProvider: 'ollama',
              fallbackModel: 'llama2',
            },
          }
        )
      ).rejects.toBe('boom-2');
      expect(calls).toBe(2);
    });
  });

  // -------------------------------------------------------------------
  // L610, L621: validateConfig non-Error coercions in inner and outer catch
  // -------------------------------------------------------------------
  describe('validateConfig non-Error coercion in catches', () => {
    it('coerces a non-Error throw from createProviderInstance into the errors[] string (L610)', async () => {
      const ctor = AnthropicProvider as unknown as {
        mockImplementationOnce: (fn: (...args: unknown[]) => unknown) => unknown;
      };
      ctor.mockImplementationOnce(function () {
        // eslint-disable-next-line no-throw-literal
        throw 'plain-string-from-anthropic';
      });
      const result = await validateConfig(AgentRole.CODEGEN);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => /plain-string-from-anthropic/.test(e))).toBe(true);
    });

    it('coerces a non-Error throw from resolveLLMConfig in the outer catch (L621)', async () => {
      const evil: TenantLLMConfig = { tenantId: 't' };
      Object.defineProperty(evil, 'roleOverrides', {
        get() {
          // eslint-disable-next-line no-throw-literal
          throw 'outer-string-error';
        },
      });
      const result = await validateConfig(AgentRole.CODEGEN, evil);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => /outer-string-error/.test(e))).toBe(true);
    });
  });

  // -------------------------------------------------------------------
  // L253: onProviderEvent disposer with already-removed listener
  // -------------------------------------------------------------------
  describe('onProviderEvent disposer idempotency (L253)', () => {
    it('handles the case where the listener is already gone (index === -1)', () => {
      const listener = () => undefined;
      const off1 = onProviderEvent(listener);
      // First disposer call removes it
      off1();
      // Second call: index === -1 path — must not throw
      expect(() => off1()).not.toThrow();
    });
  });

  // -------------------------------------------------------------------
  // L580, L590: validateConfig skips maxTokens/temperature blocks when undefined
  // -------------------------------------------------------------------
  describe('validateConfig skips optional fields when undefined', () => {
    it('does not error or warn when neither maxTokens nor temperature is set', async () => {
      // Override defaultConfig so these are explicitly undefined.
      const tenantConfig: TenantLLMConfig = {
        tenantId: 't',
        defaultConfig: {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: undefined,
          temperature: undefined,
        },
      };
      const result = await validateConfig(AgentRole.PLANNING, tenantConfig);
      // valid may be true/false depending on default model presence; what matters is
      // we don’t crash and the maxTokens/temperature error/warning paths are skipped.
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors.some((e) => /maxTokens/.test(e))).toBe(false);
      expect(result.errors.some((e) => /temperature/.test(e))).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // L669: getConfigSummary without tenantConfig.defaultConfig
  // -------------------------------------------------------------------
  describe('getConfigSummary without defaultConfig', () => {
    it('runs cleanly when tenantConfig has no defaultConfig', () => {
      const tenantConfig: TenantLLMConfig = { tenantId: 't' };
      const summary = getConfigSummary(AgentRole.CODEGEN, tenantConfig);
      expect(summary.tenantOverrides).toEqual({});
    });

    it('runs cleanly with no tenantConfig at all', () => {
      const summary = getConfigSummary(AgentRole.CODEGEN);
      expect(summary.tenantOverrides).toEqual({});
    });
  });
});
