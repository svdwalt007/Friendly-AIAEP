import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getProvider,
  getProviderWithFallback,
  executeWithFallback,
  resolveLLMConfig,
  validateConfig,
  clearProviderCache,
  onProviderEvent,
  getAvailableRoles,
  getDefaultConfig,
  isProviderSupported,
  getConfigSummary,
  AGENT_LLM_MAP,
} from './factory';
import { AgentRole } from './usage-tracker';
import type { TenantLLMConfig, LLMProvider, ProviderEvent } from './types';
import { AnthropicProvider } from './providers/anthropic';
import { OllamaProvider } from './providers/ollama';

// Mock providers
vi.mock('./providers/anthropic');
vi.mock('./providers/ollama');

describe('LLM Provider Factory', () => {
  // Store original env vars
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearProviderCache();
    vi.clearAllMocks();
    // Reset environment variables
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('resolveLLMConfig', () => {
    it('should return default config for agent role', () => {
      const config = resolveLLMConfig(AgentRole.CODEGEN);

      expect(config).toEqual(AGENT_LLM_MAP[AgentRole.CODEGEN]);
      expect(config.provider).toBe('anthropic');
      expect(config.model).toBe('claude-opus-4-6');
    });

    it('should apply tenant default config', () => {
      const tenantConfig: TenantLLMConfig = {
        tenantId: 'tenant-123',
        defaultConfig: {
          provider: 'ollama',
          model: 'llama2',
          maxTokens: 2048,
        },
      };

      const config = resolveLLMConfig(AgentRole.CODEGEN, tenantConfig);

      expect(config.provider).toBe('ollama');
      expect(config.model).toBe('llama2');
      expect(config.maxTokens).toBe(2048);
    });

    it('should apply tenant role-specific overrides', () => {
      const tenantConfig: TenantLLMConfig = {
        tenantId: 'tenant-123',
        roleOverrides: {
          [AgentRole.CODEGEN]: {
            provider: 'ollama',
            model: 'codellama',
            temperature: 0.1,
          },
        },
      };

      const config = resolveLLMConfig(AgentRole.CODEGEN, tenantConfig);

      expect(config.provider).toBe('ollama');
      expect(config.model).toBe('codellama');
      expect(config.temperature).toBe(0.1);
    });

    it('should prioritize role overrides over default config', () => {
      const tenantConfig: TenantLLMConfig = {
        tenantId: 'tenant-123',
        defaultConfig: {
          provider: 'ollama',
          model: 'llama2',
        },
        roleOverrides: {
          [AgentRole.CODEGEN]: {
            model: 'codellama',
          },
        },
      };

      const config = resolveLLMConfig(AgentRole.CODEGEN, tenantConfig);

      expect(config.provider).toBe('ollama');
      expect(config.model).toBe('codellama');
    });

    it('should apply legacy tenant fields', () => {
      const tenantConfig: TenantLLMConfig = {
        tenantId: 'tenant-123',
        provider: 'ollama',
        model: 'llama2',
        maxTokens: 1024,
        temperature: 0.5,
      };

      const config = resolveLLMConfig(AgentRole.ASSISTANT, tenantConfig);

      expect(config.provider).toBe('ollama');
      expect(config.model).toBe('llama2');
      expect(config.maxTokens).toBe(1024);
      expect(config.temperature).toBe(0.5);
    });

    it('should apply environment variable overrides with highest priority', () => {
      process.env['LLM_PROVIDER'] = 'ollama';
      process.env['LLM_MODEL'] = 'llama3';
      process.env['LLM_MAX_TOKENS'] = '2048';
      process.env['LLM_TEMPERATURE'] = '0.8';

      const tenantConfig: TenantLLMConfig = {
        tenantId: 'tenant-123',
        provider: 'anthropic',
        model: 'claude-3-opus',
      };

      const config = resolveLLMConfig(AgentRole.CODEGEN, tenantConfig);

      expect(config.provider).toBe('ollama');
      expect(config.model).toBe('llama3');
      expect(config.maxTokens).toBe(2048);
      expect(config.temperature).toBe(0.8);
    });

    it('should apply fallback configuration from environment', () => {
      process.env['LLM_FALLBACK_PROVIDER'] = 'ollama';
      process.env['LLM_FALLBACK_MODEL'] = 'llama2';

      const config = resolveLLMConfig(AgentRole.CODEGEN);

      expect(config.fallbackProvider).toBe('ollama');
      expect(config.fallbackModel).toBe('llama2');
    });

    it('should ignore invalid environment values', () => {
      process.env['LLM_MAX_TOKENS'] = 'invalid';
      process.env['LLM_TEMPERATURE'] = 'not-a-number';

      const config = resolveLLMConfig(AgentRole.CODEGEN);

      // Should use default values, not the invalid env vars
      expect(config.maxTokens).toBe(AGENT_LLM_MAP[AgentRole.CODEGEN].maxTokens);
      expect(config.temperature).toBe(AGENT_LLM_MAP[AgentRole.CODEGEN].temperature);
    });

    it('should validate temperature range', () => {
      process.env['LLM_TEMPERATURE'] = '1.5'; // Out of range

      const config = resolveLLMConfig(AgentRole.CODEGEN);

      // Should not apply invalid temperature
      expect(config.temperature).not.toBe(1.5);
    });
  });

  describe('getProvider', () => {
    it('should create and return Anthropic provider', () => {
      const mockProvider = { type: 'anthropic' } as AnthropicProvider;
      vi.mocked(AnthropicProvider).mockImplementation(() => mockProvider);

      const provider = getProvider(AgentRole.CODEGEN);

      expect(provider).toBe(mockProvider);
      expect(AnthropicProvider).toHaveBeenCalled();
    });

    it('should create and return Ollama provider', () => {
      const mockProvider = { type: 'ollama' } as OllamaProvider;
      vi.mocked(OllamaProvider).mockImplementation(() => mockProvider);

      process.env['LLM_PROVIDER'] = 'ollama';

      const provider = getProvider(AgentRole.CODEGEN);

      expect(provider).toBe(mockProvider);
      expect(OllamaProvider).toHaveBeenCalled();
    });

    it('should use cached provider instance', () => {
      const mockProvider = { type: 'anthropic' } as AnthropicProvider;
      vi.mocked(AnthropicProvider).mockImplementation(() => mockProvider);

      const provider1 = getProvider(AgentRole.CODEGEN);
      const provider2 = getProvider(AgentRole.CODEGEN);

      expect(provider1).toBe(provider2);
      expect(AnthropicProvider).toHaveBeenCalledTimes(1);
    });

    it('should create different providers for different models', () => {
      const mockProvider1 = { type: 'anthropic' } as AnthropicProvider;
      const mockProvider2 = { type: 'anthropic' } as AnthropicProvider;

      vi.mocked(AnthropicProvider)
        .mockImplementationOnce(() => mockProvider1)
        .mockImplementationOnce(() => mockProvider2);

      const provider1 = getProvider(AgentRole.CODEGEN);
      const provider2 = getProvider(AgentRole.ORCHESTRATOR);

      // Same provider type but different models, so different instances
      expect(AnthropicProvider).toHaveBeenCalledTimes(2);
    });

    it('should pass API key from environment for Anthropic', () => {
      process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test-key';

      const mockProvider = { type: 'anthropic' } as AnthropicProvider;
      vi.mocked(AnthropicProvider).mockImplementation(() => mockProvider);

      getProvider(AgentRole.CODEGEN);

      expect(AnthropicProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'sk-ant-test-key',
        })
      );
    });

    it('should pass base URL from environment for Ollama', () => {
      process.env['LLM_PROVIDER'] = 'ollama';
      process.env['OLLAMA_BASE_URL'] = 'http://custom:11434';

      const mockProvider = { type: 'ollama' } as OllamaProvider;
      vi.mocked(OllamaProvider).mockImplementation(() => mockProvider);

      getProvider(AgentRole.CODEGEN);

      expect(OllamaProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'http://custom:11434',
        })
      );
    });

    it('should use default Ollama URL if not specified', () => {
      process.env['LLM_PROVIDER'] = 'ollama';

      const mockProvider = { type: 'ollama' } as OllamaProvider;
      vi.mocked(OllamaProvider).mockImplementation(() => mockProvider);

      getProvider(AgentRole.CODEGEN);

      expect(OllamaProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'http://localhost:11434',
        })
      );
    });
  });

  describe('clearProviderCache', () => {
    it('should clear cached providers', () => {
      const mockProvider = { type: 'anthropic' } as AnthropicProvider;
      vi.mocked(AnthropicProvider).mockImplementation(() => mockProvider);

      getProvider(AgentRole.CODEGEN);
      clearProviderCache();
      getProvider(AgentRole.CODEGEN);

      expect(AnthropicProvider).toHaveBeenCalledTimes(2);
    });
  });

  describe('getProviderWithFallback', () => {
    it('should return primary provider only when no fallback configured', () => {
      const mockPrimary = { type: 'anthropic' } as AnthropicProvider;
      vi.mocked(AnthropicProvider).mockImplementation(() => mockPrimary);

      const result = getProviderWithFallback(AgentRole.CODEGEN);

      expect(result.primary).toBe(mockPrimary);
      expect(result.fallback).toBeUndefined();
      expect(result.config).toBeDefined();
    });

    it('should return both primary and fallback providers when configured', () => {
      const mockPrimary = { type: 'anthropic' } as AnthropicProvider;
      const mockFallback = { type: 'ollama' } as OllamaProvider;

      vi.mocked(AnthropicProvider).mockImplementation(() => mockPrimary);
      vi.mocked(OllamaProvider).mockImplementation(() => mockFallback);

      process.env['LLM_FALLBACK_PROVIDER'] = 'ollama';
      process.env['LLM_FALLBACK_MODEL'] = 'llama2';

      const result = getProviderWithFallback(AgentRole.CODEGEN);

      expect(result.primary).toBe(mockPrimary);
      expect(result.fallback).toBe(mockFallback);
      expect(result.config.fallbackProvider).toBe('ollama');
      expect(result.config.fallbackModel).toBe('llama2');
    });

    it('should not create fallback provider if only provider specified', () => {
      const mockPrimary = { type: 'anthropic' } as AnthropicProvider;
      vi.mocked(AnthropicProvider).mockImplementation(() => mockPrimary);

      process.env['LLM_FALLBACK_PROVIDER'] = 'ollama';
      // No fallback model specified

      const result = getProviderWithFallback(AgentRole.CODEGEN);

      expect(result.fallback).toBeUndefined();
    });
  });

  describe('executeWithFallback', () => {
    it('should execute with primary provider when successful', async () => {
      const mockPrimary = { type: 'anthropic' } as LLMProvider;
      vi.mocked(AnthropicProvider).mockImplementation(() => mockPrimary as AnthropicProvider);

      const requestFn = vi.fn().mockResolvedValue('success');

      const result = await executeWithFallback(AgentRole.CODEGEN, requestFn);

      expect(result).toBe('success');
      expect(requestFn).toHaveBeenCalledWith(mockPrimary);
      expect(requestFn).toHaveBeenCalledTimes(1);
    });

    it('should fallback to secondary provider on primary failure', async () => {
      const mockPrimary = { type: 'anthropic' } as LLMProvider;
      const mockFallback = { type: 'ollama' } as LLMProvider;

      vi.mocked(AnthropicProvider).mockImplementation(() => mockPrimary as AnthropicProvider);
      vi.mocked(OllamaProvider).mockImplementation(() => mockFallback as OllamaProvider);

      process.env['LLM_FALLBACK_PROVIDER'] = 'ollama';
      process.env['LLM_FALLBACK_MODEL'] = 'llama2';

      const requestFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Primary failed'))
        .mockResolvedValueOnce('fallback success');

      const result = await executeWithFallback(AgentRole.CODEGEN, requestFn);

      expect(result).toBe('fallback success');
      expect(requestFn).toHaveBeenCalledTimes(2);
      expect(requestFn).toHaveBeenCalledWith(mockPrimary);
      expect(requestFn).toHaveBeenCalledWith(mockFallback);
    });

    it('should throw error when both providers fail', async () => {
      const mockPrimary = { type: 'anthropic' } as LLMProvider;
      const mockFallback = { type: 'ollama' } as LLMProvider;

      vi.mocked(AnthropicProvider).mockImplementation(() => mockPrimary as AnthropicProvider);
      vi.mocked(OllamaProvider).mockImplementation(() => mockFallback as OllamaProvider);

      process.env['LLM_FALLBACK_PROVIDER'] = 'ollama';
      process.env['LLM_FALLBACK_MODEL'] = 'llama2';

      const requestFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Primary failed'))
        .mockRejectedValueOnce(new Error('Fallback failed'));

      await expect(executeWithFallback(AgentRole.CODEGEN, requestFn)).rejects.toThrow(
        'Fallback failed'
      );

      expect(requestFn).toHaveBeenCalledTimes(2);
    });

    it('should throw primary error when no fallback configured', async () => {
      const mockPrimary = { type: 'anthropic' } as LLMProvider;
      vi.mocked(AnthropicProvider).mockImplementation(() => mockPrimary as AnthropicProvider);

      const requestFn = vi.fn().mockRejectedValue(new Error('Primary failed'));

      await expect(executeWithFallback(AgentRole.CODEGEN, requestFn)).rejects.toThrow(
        'Primary failed'
      );

      expect(requestFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', async () => {
      const mockProvider = {
        type: 'anthropic',
        validateConfig: vi.fn().mockResolvedValue(true),
      } as unknown as AnthropicProvider;

      vi.mocked(AnthropicProvider).mockImplementation(() => mockProvider);

      const result = await validateConfig(AgentRole.CODEGEN);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid provider type', async () => {
      const tenantConfig: TenantLLMConfig = {
        tenantId: 'tenant-123',
        provider: 'invalid' as any,
      };

      const result = await validateConfig(AgentRole.CODEGEN, tenantConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid provider type: invalid');
    });

    it('should detect missing model', async () => {
      const tenantConfig: TenantLLMConfig = {
        tenantId: 'tenant-123',
        defaultConfig: {
          provider: 'anthropic',
          model: '',
        },
      };

      const result = await validateConfig(AgentRole.CODEGEN, tenantConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Model is required');
    });

    it('should detect invalid maxTokens', async () => {
      const tenantConfig: TenantLLMConfig = {
        tenantId: 'tenant-123',
        defaultConfig: {
          provider: 'anthropic',
          model: 'claude-3-opus',
          maxTokens: -100,
        },
      };

      const result = await validateConfig(AgentRole.CODEGEN, tenantConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('maxTokens must be greater than 0');
    });

    it('should warn about very high maxTokens', async () => {
      const mockProvider = {
        type: 'anthropic',
        validateConfig: vi.fn().mockResolvedValue(true),
      } as unknown as AnthropicProvider;

      vi.mocked(AnthropicProvider).mockImplementation(() => mockProvider);

      const tenantConfig: TenantLLMConfig = {
        tenantId: 'tenant-123',
        defaultConfig: {
          provider: 'anthropic',
          model: 'claude-3-opus',
          maxTokens: 300000,
        },
      };

      const result = await validateConfig(AgentRole.CODEGEN, tenantConfig);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('maxTokens is very high');
    });

    it('should detect invalid temperature', async () => {
      const tenantConfig: TenantLLMConfig = {
        tenantId: 'tenant-123',
        defaultConfig: {
          provider: 'anthropic',
          model: 'claude-3-opus',
          temperature: 2.0,
        },
      };

      const result = await validateConfig(AgentRole.CODEGEN, tenantConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('temperature must be between 0 and 1');
    });

    it('should detect missing fallback model', async () => {
      const mockProvider = {
        type: 'anthropic',
        validateConfig: vi.fn().mockResolvedValue(true),
      } as unknown as AnthropicProvider;

      vi.mocked(AnthropicProvider).mockImplementation(() => mockProvider);

      const tenantConfig: TenantLLMConfig = {
        tenantId: 'tenant-123',
        defaultConfig: {
          provider: 'anthropic',
          model: 'claude-3-opus',
          fallbackProvider: 'ollama',
        },
      };

      const result = await validateConfig(AgentRole.CODEGEN, tenantConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'fallbackModel is required when fallbackProvider is specified'
      );
    });

    it('should detect provider validation failure', async () => {
      const mockProvider = {
        type: 'anthropic',
        validateConfig: vi.fn().mockResolvedValue(false),
      } as unknown as AnthropicProvider;

      vi.mocked(AnthropicProvider).mockImplementation(() => mockProvider);

      const result = await validateConfig(AgentRole.CODEGEN);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Provider configuration validation failed');
    });

    it('should handle provider creation errors', async () => {
      vi.mocked(AnthropicProvider).mockImplementation(() => {
        throw new Error('Failed to create provider');
      });

      const result = await validateConfig(AgentRole.CODEGEN);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Failed to create provider');
    });
  });

  describe('onProviderEvent', () => {
    it('should register and receive provider events', () => {
      const listener = vi.fn();
      const unsubscribe = onProviderEvent(listener);

      // Trigger an event by getting a provider
      const mockProvider = { type: 'anthropic' } as AnthropicProvider;
      vi.mocked(AnthropicProvider).mockImplementation(() => mockProvider);
      getProvider(AgentRole.CODEGEN);

      expect(listener).toHaveBeenCalled();
      const event: ProviderEvent = listener.mock.calls[0][0];
      expect(event.eventType).toBe('provider_created');

      unsubscribe();
    });

    it('should unsubscribe from events', () => {
      const listener = vi.fn();
      const unsubscribe = onProviderEvent(listener);

      clearProviderCache();
      unsubscribe();

      // Get provider after unsubscribe
      const mockProvider = { type: 'anthropic' } as AnthropicProvider;
      vi.mocked(AnthropicProvider).mockImplementation(() => mockProvider);
      getProvider(AgentRole.CODEGEN);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should emit cache hit events', () => {
      const listener = vi.fn();
      onProviderEvent(listener);

      const mockProvider = { type: 'anthropic' } as AnthropicProvider;
      vi.mocked(AnthropicProvider).mockImplementation(() => mockProvider);

      getProvider(AgentRole.CODEGEN);
      listener.mockClear();

      getProvider(AgentRole.CODEGEN);

      expect(listener).toHaveBeenCalled();
      const event: ProviderEvent = listener.mock.calls[0][0];
      expect(event.eventType).toBe('cache_hit');
    });
  });

  describe('utility functions', () => {
    it('getAvailableRoles should return all agent roles', () => {
      const roles = getAvailableRoles();

      expect(roles).toContain(AgentRole.CODEGEN);
      expect(roles).toContain(AgentRole.ORCHESTRATOR);
      expect(roles).toContain(AgentRole.WIDGET_BUILDER);
      expect(roles.length).toBeGreaterThan(10);
    });

    it('getDefaultConfig should return role default config', () => {
      const config = getDefaultConfig(AgentRole.CODEGEN);

      expect(config).toEqual(AGENT_LLM_MAP[AgentRole.CODEGEN]);
      expect(config.provider).toBe('anthropic');
    });

    it('isProviderSupported should validate provider types', () => {
      expect(isProviderSupported('anthropic')).toBe(true);
      expect(isProviderSupported('ollama')).toBe(true);
      expect(isProviderSupported('invalid')).toBe(false);
    });

    it('getConfigSummary should return detailed config information', () => {
      process.env['LLM_TEMPERATURE'] = '0.5';

      const tenantConfig: TenantLLMConfig = {
        tenantId: 'tenant-123',
        defaultConfig: {
          model: 'custom-model',
        },
      };

      const summary = getConfigSummary(AgentRole.CODEGEN, tenantConfig);

      expect(summary.agentRole).toBe(AgentRole.CODEGEN);
      expect(summary.defaultConfig).toEqual(AGENT_LLM_MAP[AgentRole.CODEGEN]);
      expect(summary.environmentOverrides.temperature).toBe(0.5);
      expect(summary.tenantOverrides.model).toBe('custom-model');
      expect(summary.resolvedConfig.model).toBe('custom-model');
    });
  });
});
