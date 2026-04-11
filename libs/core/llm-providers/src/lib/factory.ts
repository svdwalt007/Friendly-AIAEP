/**
 * LLM Provider Factory
 *
 * Manages the creation and configuration of LLM providers for different agent roles.
 * Supports tenant-specific configurations, environment variable overrides, and fallback chains.
 */

import {
  LLMConfig,
  LLMProvider,
  ProviderType,
  TenantLLMConfig,
  ProviderEvent,
  ConfigValidationResult,
} from './types';
import { AgentRole } from './usage-tracker';
import { AnthropicProvider } from './providers/anthropic';
import { OllamaProvider } from './providers/ollama';

/**
 * Default LLM configuration for each agent role
 * All roles default to claude-opus-4-6 as specified
 */
export const AGENT_LLM_MAP: Partial<Record<AgentRole, LLMConfig>> = {
  // Core Orchestration
  [AgentRole.SUPERVISOR]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 8192,
    temperature: 0.7,
  },
  [AgentRole.ORCHESTRATOR]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 8192,
    temperature: 0.7,
  },
  [AgentRole.PLANNING]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 8192,
    temperature: 0.6,
  },

  // Builder Agents
  [AgentRole.PAGE_COMPOSER]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 4096,
    temperature: 0.5,
  },
  [AgentRole.WIDGET_BUILDER]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 4096,
    temperature: 0.5,
  },
  [AgentRole.CODEGEN]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 8192,
    temperature: 0.3,
  },
  [AgentRole.TEMPLATE_DESIGNER]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 4096,
    temperature: 0.6,
  },
  [AgentRole.ANGULAR_COMPOSER]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 4096,
    temperature: 0.5,
  },

  // IoT Agents
  [AgentRole.IOT_ADAPTER]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 4096,
    temperature: 0.4,
  },
  [AgentRole.IOT_DOMAIN]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 4096,
    temperature: 0.4,
  },
  [AgentRole.SWAGGER_ANALYZER]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 4096,
    temperature: 0.3,
  },
  [AgentRole.SWAGGER_API]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 4096,
    temperature: 0.3,
  },
  [AgentRole.SDK_GENERATOR]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 8192,
    temperature: 0.3,
  },

  // Data & Analytics
  [AgentRole.QUERY_BUILDER]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 4096,
    temperature: 0.4,
  },
  [AgentRole.DASHBOARD_DESIGNER]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 4096,
    temperature: 0.5,
  },
  [AgentRole.GRAFANA]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 4096,
    temperature: 0.5,
  },
  [AgentRole.DATABASE]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 4096,
    temperature: 0.3,
  },

  // Deployment Agents
  [AgentRole.DOCKER_GENERATOR]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 4096,
    temperature: 0.3,
  },
  [AgentRole.HELM_GENERATOR]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 4096,
    temperature: 0.3,
  },
  [AgentRole.DEPLOYMENT]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 4096,
    temperature: 0.3,
  },

  // Security & Compliance
  [AgentRole.SECURITY]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 4096,
    temperature: 0.2,
  },
  [AgentRole.POLICY_ENFORCER]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 4096,
    temperature: 0.2,
  },

  // Billing & Licensing
  [AgentRole.BILLING]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 4096,
    temperature: 0.3,
  },

  // Quality Assurance
  [AgentRole.QA_TEST]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 4096,
    temperature: 0.4,
  },

  // General Purpose
  [AgentRole.ASSISTANT]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 4096,
    temperature: 0.7,
  },
  [AgentRole.BUILDER]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 4096,
    temperature: 0.5,
  },
  [AgentRole.CODE_GENERATOR]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 8192,
    temperature: 0.3,
  },
  [AgentRole.CUSTOM]: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 4096,
    temperature: 0.7,
  },
};

/**
 * Default configuration for roles not in AGENT_LLM_MAP
 */
const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: 'anthropic',
  model: 'claude-opus-4-6',
  maxTokens: 4096,
  temperature: 0.7,
};

/**
 * Provider cache for singleton pattern
 * Key format: "provider:model"
 */
const providerCache = new Map<string, LLMProvider>();

/**
 * Event listeners for provider events
 */
const eventListeners: Array<(event: ProviderEvent) => void> = [];

/**
 * Emit a provider event to all registered listeners
 */
function emitEvent(event: ProviderEvent): void {
  eventListeners.forEach(listener => {
    try {
      listener(event);
    } catch (error) {
      console.error('Error in provider event listener:', error);
    }
  });
}

/**
 * Register an event listener for provider events
 */
export function onProviderEvent(listener: (event: ProviderEvent) => void): () => void {
  eventListeners.push(listener);
  return () => {
    const index = eventListeners.indexOf(listener);
    if (index !== -1) {
      eventListeners.splice(index, 1);
    }
  };
}

/**
 * Clear the provider cache
 * Useful for testing or when configuration changes
 */
export function clearProviderCache(): void {
  providerCache.clear();
}

/**
 * Get environment variable overrides for LLM configuration
 */
function getEnvironmentOverrides(): Partial<LLMConfig> {
  const overrides: Partial<LLMConfig> = {};

  // Primary provider and model
  const envProvider = process.env['LLM_PROVIDER'] as ProviderType | undefined;
  const envModel = process.env['LLM_MODEL'];

  if (envProvider && (envProvider === 'anthropic' || envProvider === 'ollama')) {
    overrides.provider = envProvider;
  }

  if (envModel) {
    overrides.model = envModel;
  }

  // Fallback configuration
  const envFallbackProvider = process.env['LLM_FALLBACK_PROVIDER'] as ProviderType | undefined;
  const envFallbackModel = process.env['LLM_FALLBACK_MODEL'];

  if (envFallbackProvider && (envFallbackProvider === 'anthropic' || envFallbackProvider === 'ollama')) {
    overrides.fallbackProvider = envFallbackProvider;
  }

  if (envFallbackModel) {
    overrides.fallbackModel = envFallbackModel;
  }

  // Generation parameters
  const envMaxTokens = process.env['LLM_MAX_TOKENS'];
  const envTemperature = process.env['LLM_TEMPERATURE'];

  if (envMaxTokens) {
    const maxTokens = parseInt(envMaxTokens, 10);
    if (!isNaN(maxTokens) && maxTokens > 0) {
      overrides.maxTokens = maxTokens;
    }
  }

  if (envTemperature) {
    const temperature = parseFloat(envTemperature);
    if (!isNaN(temperature) && temperature >= 0 && temperature <= 1) {
      overrides.temperature = temperature;
    }
  }

  return overrides;
}

/**
 * Resolve the final LLM configuration for an agent role
 *
 * Priority order:
 * 1. Environment variables (highest priority)
 * 2. Tenant-specific role overrides
 * 3. Tenant default config
 * 4. Agent role defaults from AGENT_LLM_MAP
 */
export function resolveLLMConfig(
  agentRole: AgentRole,
  tenantConfig?: TenantLLMConfig
): LLMConfig {
  // Start with agent role defaults or use DEFAULT_LLM_CONFIG
  const baseConfig = { ...(AGENT_LLM_MAP[agentRole] || DEFAULT_LLM_CONFIG) };

  // Apply tenant default config
  if (tenantConfig?.defaultConfig) {
    Object.assign(baseConfig, tenantConfig.defaultConfig);
  }

  // Apply tenant role-specific overrides
  if (tenantConfig?.roleOverrides?.[agentRole]) {
    Object.assign(baseConfig, tenantConfig.roleOverrides[agentRole]);
  }

  // Apply legacy tenant config if present
  if (tenantConfig?.provider) {
    baseConfig.provider = tenantConfig.provider;
  }
  if (tenantConfig?.model) {
    baseConfig.model = tenantConfig.model;
  }
  if (tenantConfig?.maxTokens) {
    baseConfig.maxTokens = tenantConfig.maxTokens;
  }
  if (tenantConfig?.temperature !== undefined) {
    baseConfig.temperature = tenantConfig.temperature;
  }

  // Apply environment variable overrides (highest priority)
  const envOverrides = getEnvironmentOverrides();
  Object.assign(baseConfig, envOverrides);

  return baseConfig;
}

/**
 * Create a provider instance from configuration
 */
function createProviderInstance(
  providerType: ProviderType,
  model: string
): LLMProvider {
  const cacheKey = `${providerType}:${model}`;

  // Check cache first
  if (providerCache.has(cacheKey)) {
    const cached = providerCache.get(cacheKey)!;
    emitEvent({
      timestamp: new Date(),
      eventType: 'cache_hit',
      provider: providerType,
      message: `Using cached provider instance for ${providerType}:${model}`,
    });
    return cached;
  }

  // Create provider instance
  let provider: LLMProvider;

  if (providerType === 'anthropic') {
    // Create Anthropic-specific config
    const anthropicConfig = {
      type: 'anthropic' as const,
      apiKey: process.env['ANTHROPIC_API_KEY'] || '',
      baseUrl: process.env['ANTHROPIC_API_URL'],
      defaultModel: model,
      timeout: process.env['ANTHROPIC_TIMEOUT']
        ? parseInt(process.env['ANTHROPIC_TIMEOUT'], 10)
        : undefined,
      maxRetries: process.env['ANTHROPIC_MAX_RETRIES']
        ? parseInt(process.env['ANTHROPIC_MAX_RETRIES'], 10)
        : undefined,
    };
    provider = new AnthropicProvider(anthropicConfig) as any;
  } else if (providerType === 'ollama') {
    // Create Ollama-specific config
    const ollamaConfig: LLMConfig = {
      provider: 'ollama',
      model,
      baseUrl: process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434',
      timeout: process.env['OLLAMA_TIMEOUT']
        ? parseInt(process.env['OLLAMA_TIMEOUT'], 10)
        : 30000,
    };
    provider = new OllamaProvider(ollamaConfig) as any;
  } else {
    throw new Error(`Unsupported provider type: ${providerType}`);
  }

  // Cache the instance
  providerCache.set(cacheKey, provider);

  emitEvent({
    timestamp: new Date(),
    eventType: 'provider_created',
    provider: providerType,
    message: `Created new provider instance for ${providerType}:${model}`,
  });

  return provider;
}

/**
 * Get an LLM provider for the specified agent role
 *
 * This is the main entry point for obtaining configured LLM providers.
 * It handles configuration resolution, provider instantiation, and caching.
 *
 * @param agentRole - The agent role requesting the provider
 * @param tenantConfig - Optional tenant-specific configuration
 * @returns Configured LLM provider instance
 *
 * @example
 * ```typescript
 * const provider = getProvider(AgentRole.CODEGEN);
 * const response = await provider.complete({
 *   model: provider.config.defaultModel!,
 *   messages: [{ role: 'user', content: 'Generate a React component' }],
 *   max_tokens: 4096
 * });
 * ```
 */
export function getProvider(
  agentRole: AgentRole,
  tenantConfig?: TenantLLMConfig
): LLMProvider {
  const config = resolveLLMConfig(agentRole, tenantConfig);
  return createProviderInstance(config.provider, config.model);
}

/**
 * Get a provider with fallback support
 *
 * Attempts to use the primary provider, falling back to the secondary if configured.
 * This is a wrapper around getProvider that adds retry logic.
 *
 * @param agentRole - The agent role requesting the provider
 * @param tenantConfig - Optional tenant-specific configuration
 * @returns Object with primary provider and optional fallback provider
 */
export function getProviderWithFallback(
  agentRole: AgentRole,
  tenantConfig?: TenantLLMConfig
): {
  primary: LLMProvider;
  fallback?: LLMProvider;
  config: LLMConfig;
} {
  const config = resolveLLMConfig(agentRole, tenantConfig);
  const primary = createProviderInstance(config.provider, config.model);

  let fallback: LLMProvider | undefined;
  if (config.fallbackProvider && config.fallbackModel) {
    fallback = createProviderInstance(config.fallbackProvider, config.fallbackModel);
  }

  return { primary, fallback, config };
}

/**
 * Execute an LLM request with automatic fallback
 *
 * This is a high-level helper that handles the fallback chain automatically.
 * If the primary provider fails, it will try the fallback provider.
 *
 * @param agentRole - The agent role making the request
 * @param requestFn - Function that executes the LLM request
 * @param tenantConfig - Optional tenant-specific configuration
 * @returns Response from the LLM provider
 */
export async function executeWithFallback<T>(
  agentRole: AgentRole,
  requestFn: (provider: LLMProvider) => Promise<T>,
  tenantConfig?: TenantLLMConfig
): Promise<T> {
  const { primary, fallback, config } = getProviderWithFallback(agentRole, tenantConfig);

  try {
    return await requestFn(primary);
  } catch (primaryError) {
    const errorMessage = primaryError instanceof Error ? primaryError.message : String(primaryError);

    emitEvent({
      timestamp: new Date(),
      eventType: 'error',
      agentRole,
      provider: config.provider,
      message: `Primary provider failed: ${errorMessage}`,
      metadata: { error: primaryError },
    });

    if (!fallback) {
      throw primaryError;
    }

    emitEvent({
      timestamp: new Date(),
      eventType: 'fallback',
      agentRole,
      provider: config.fallbackProvider!,
      message: `Falling back to ${config.fallbackProvider}:${config.fallbackModel}`,
    });

    try {
      return await requestFn(fallback);
    } catch (fallbackError) {
      const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);

      emitEvent({
        timestamp: new Date(),
        eventType: 'error',
        agentRole,
        provider: config.fallbackProvider!,
        message: `Fallback provider also failed: ${fallbackErrorMessage}`,
        metadata: { error: fallbackError, primaryError },
      });

      throw fallbackError;
    }
  }
}

/**
 * Validate LLM configuration for an agent role
 *
 * Checks that the configuration is valid and the provider is accessible.
 */
export async function validateConfig(
  agentRole: AgentRole,
  tenantConfig?: TenantLLMConfig
): Promise<ConfigValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const config = resolveLLMConfig(agentRole, tenantConfig);

    // Validate provider type
    if (!config.provider) {
      errors.push('Provider type is required');
    } else if (config.provider !== 'anthropic' && config.provider !== 'ollama') {
      errors.push(`Invalid provider type: ${config.provider}`);
    }

    // Validate model
    if (!config.model) {
      errors.push('Model is required');
    }

    // Validate max tokens
    if (config.maxTokens !== undefined) {
      if (config.maxTokens <= 0) {
        errors.push('maxTokens must be greater than 0');
      }
      if (config.maxTokens > 200000) {
        warnings.push('maxTokens is very high (>200k), this may cause issues');
      }
    }

    // Validate temperature
    if (config.temperature !== undefined) {
      if (config.temperature < 0 || config.temperature > 1) {
        errors.push('temperature must be between 0 and 1');
      }
    }

    // Validate fallback configuration
    if (config.fallbackProvider && !config.fallbackModel) {
      errors.push('fallbackModel is required when fallbackProvider is specified');
    }
    if (!config.fallbackProvider && config.fallbackModel) {
      warnings.push('fallbackModel specified without fallbackProvider');
    }

    // Try to create provider instance
    if (errors.length === 0) {
      try {
        createProviderInstance(config.provider, config.model);
        // Provider created successfully
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to create provider: ${errorMessage}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`Configuration validation error: ${errorMessage}`);
    return {
      valid: false,
      errors,
      warnings,
    };
  }
}

/**
 * Get all available agent roles
 */
export function getAvailableRoles(): AgentRole[] {
  return Object.values(AgentRole);
}

/**
 * Get the default configuration for an agent role
 */
export function getDefaultConfig(agentRole: AgentRole): LLMConfig {
  return { ...(AGENT_LLM_MAP[agentRole] || DEFAULT_LLM_CONFIG) };
}

/**
 * Check if a provider type is supported
 */
export function isProviderSupported(provider: string): provider is ProviderType {
  return provider === 'anthropic' || provider === 'ollama';
}

/**
 * Get configuration summary for debugging
 */
export function getConfigSummary(
  agentRole: AgentRole,
  tenantConfig?: TenantLLMConfig
): {
  agentRole: AgentRole;
  resolvedConfig: LLMConfig;
  defaultConfig: LLMConfig;
  environmentOverrides: Partial<LLMConfig>;
  tenantOverrides: Partial<LLMConfig>;
} {
  const defaultConfig = getDefaultConfig(agentRole);
  const environmentOverrides = getEnvironmentOverrides();

  const tenantOverrides: Partial<LLMConfig> = {};
  if (tenantConfig?.defaultConfig) {
    Object.assign(tenantOverrides, tenantConfig.defaultConfig);
  }
  if (tenantConfig?.roleOverrides?.[agentRole]) {
    Object.assign(tenantOverrides, tenantConfig.roleOverrides[agentRole]);
  }

  const resolvedConfig = resolveLLMConfig(agentRole, tenantConfig);

  return {
    agentRole,
    resolvedConfig,
    defaultConfig,
    environmentOverrides,
    tenantOverrides,
  };
}
