/**
 * Docker Generator Type Definitions
 *
 * Comprehensive type system for generating Docker Compose configurations
 * supporting both SaaS (multi-tenant) and Dedicated (self-contained) deployment modes
 * per Module Reference v2.2 Section 11.1
 */

/**
 * Deployment mode enumeration
 * - saas: Multi-tenant shared infrastructure
 * - dedicated: Self-contained single-tenant deployment
 */
export type DeploymentMode = 'saas' | 'dedicated';

/**
 * Subscription tier types aligned with pricing model
 * - starter: $499/mo - Basic features
 * - professional: $2,499/mo - Advanced features including Git push
 * - enterprise: $7,999/mo - Full features including Helm, Ollama, air-gap
 */
export type TierType = 'starter' | 'professional' | 'enterprise';

/**
 * Project configuration containing application metadata
 */
export interface ProjectConfig {
  /**
   * Unique project identifier
   */
  projectId: string;

  /**
   * Human-readable project name
   */
  projectName: string;

  /**
   * Application version following semver
   */
  version: string;

  /**
   * Git repository URL (optional, requires Professional+ tier)
   */
  gitRepo?: string;

  /**
   * Git commit SHA for traceability
   */
  gitSha?: string;

  /**
   * Subscription tier determining feature availability
   */
  tier: TierType;

  /**
   * Feature flags from license
   */
  features: {
    helm: boolean;
    git: boolean;
    ollama: boolean;
    airgap: boolean;
    thirdPartyIngestion: boolean;
    customWidgets: boolean;
  };
}

/**
 * Environment configuration for all services
 */
export interface EnvironmentConfig {
  /**
   * Deployment mode: SaaS or Dedicated
   */
  deploymentMode: DeploymentMode;

  /**
   * Base domain for service URLs
   * SaaS: *.aep.friendly-tech.com
   * Dedicated: customer-specific domain
   */
  baseDomain: string;

  /**
   * Northbound REST API configuration
   */
  northboundApi: {
    url: string;
    authMethod: 'basic' | 'apikey';
    credentials?: {
      username?: string;
      password?: string;
      apiKey?: string;
    };
  };

  /**
   * Events/Webhook REST API configuration
   */
  eventsApi: {
    url: string;
    authMethod: 'jwt' | 'apikey';
    credentials?: {
      username?: string;
      password?: string;
      apiKey?: string;
    };
  };

  /**
   * QoE/Monitoring REST API configuration
   */
  qoeApi: {
    url: string;
    authMethod: 'basic' | 'apikey';
    credentials?: {
      username?: string;
      password?: string;
      apiKey?: string;
    };
  };

  /**
   * LLM provider configuration
   */
  llmProvider: {
    /**
     * Primary provider: anthropic (Claude) or ollama (self-hosted)
     */
    provider: 'anthropic' | 'ollama';

    /**
     * Anthropic API key (required if provider is anthropic)
     */
    anthropicApiKey?: string;

    /**
     * Ollama endpoint URL (required if provider is ollama, Enterprise tier only)
     */
    ollamaUrl?: string;

    /**
     * Default model to use
     */
    defaultModel: string;

    /**
     * Fallback provider configuration
     */
    fallback?: {
      provider: 'anthropic' | 'ollama';
      apiKey?: string;
      url?: string;
      model: string;
    };
  };

  /**
   * Database configuration
   */
  database: {
    postgres: {
      host: string;
      port: number;
      database: string;
      username: string;
      password: string;
    };
    influxdb: {
      url: string;
      token: string;
      org: string;
      bucket: string;
    };
  };

  /**
   * Redis configuration for caching and rate limiting
   */
  redis: {
    host: string;
    port: number;
    password?: string;
  };

  /**
   * Grafana configuration
   */
  grafana: {
    adminUsername: string;
    adminPassword: string;
    enableSso?: boolean;
  };

  /**
   * Third-party data ingestion configuration (Professional+ tier)
   */
  thirdPartyIngestion?: {
    mqtt: {
      enabled: boolean;
      brokers: Array<{
        url: string;
        topics: string[];
        username?: string;
        password?: string;
      }>;
    };
    http: {
      enabled: boolean;
      endpoints: Array<{
        url: string;
        method: 'GET' | 'POST';
        headers?: Record<string, string>;
      }>;
    };
  };
}

/**
 * License configuration for license-agent sidecar
 */
export interface LicenseConfig {
  /**
   * License key in format: FTECH-AEP-{TIER}-{DEPLOY_MODE}-{TENANT_HASH}-{EXPIRY}-{FLAGS}-{HMAC}
   */
  licenseKey: string;

  /**
   * Tenant identifier for license validation
   */
  tenantId: string;

  /**
   * License expiry date
   */
  expiryDate: Date;

  /**
   * Grace period configuration
   * - starter: none
   * - professional: 24h
   * - enterprise: 7d + air-gap offline license file
   */
  gracePeriod: {
    enabled: boolean;
    duration: string; // e.g., '24h', '7d'
  };

  /**
   * License validation heartbeat interval (default: 1h)
   */
  heartbeatInterval: string;
}

/**
 * Docker service definition
 */
export interface ServiceDefinition {
  /**
   * Service name
   */
  name: string;

  /**
   * Docker image with tag
   */
  image: string;

  /**
   * Port mappings (host:container)
   */
  ports?: string[];

  /**
   * Environment variables
   */
  environment?: Record<string, string>;

  /**
   * Volume mounts
   */
  volumes?: string[];

  /**
   * Service dependencies
   */
  dependsOn?: string[];

  /**
   * Restart policy
   */
  restart?: 'always' | 'unless-stopped' | 'on-failure' | 'no';

  /**
   * Network mode
   */
  networks?: string[];

  /**
   * Health check configuration
   */
  healthcheck?: {
    test: string[];
    interval: string;
    timeout: string;
    retries: number;
    startPeriod?: string;
  };

  /**
   * Resource limits
   */
  deploy?: {
    resources?: {
      limits?: {
        cpus?: string;
        memory?: string;
      };
      reservations?: {
        cpus?: string;
        memory?: string;
      };
    };
  };

  /**
   * Command override
   */
  command?: string | string[];
}

/**
 * Complete Docker stack configuration
 * Generated as actual file contents (template-based approach per Module Reference v2.2 Section 11.1)
 */
export interface DockerStack {
  /**
   * docker-compose.yml file content (base configuration)
   * Includes all 9 core services with mode-specific settings
   */
  composeYml: string;

  /**
   * docker-compose.prod.yml file content (production overrides)
   * Resource limits, health checks, logging configuration
   */
  composeProYml: string;

  /**
   * .env.template file content
   * 50+ environment variables for three APIs, LLM provider, deployment mode
   */
  envTemplate: string;

  /**
   * nginx reverse proxy configuration
   * Routes for /api/*, /grafana/*, /ws/*, /* (frontend)
   */
  nginxConf: string;

  /**
   * Service Dockerfiles
   * Custom builds for frontend, iot-api-proxy, telegraf (conditional)
   */
  dockerfiles: Record<string, string>;

  /**
   * README.md with deployment instructions
   */
  readme?: string;
}

/**
 * Template rendering context
 */
export interface TemplateContext {
  project: ProjectConfig;
  environment: EnvironmentConfig;
  license: LicenseConfig;

  /**
   * Computed flags for conditional rendering
   */
  isSaas: boolean;
  isDedicated: boolean;
  isStarter: boolean;
  isProfessional: boolean;
  isEnterprise: boolean;

  /**
   * Feature availability flags
   */
  hasHelm: boolean;
  hasGit: boolean;
  hasOllama: boolean;
  hasAirgap: boolean;
  hasThirdPartyIngestion: boolean;
  hasCustomWidgets: boolean;
}

/**
 * Validation result for Docker Compose or env template
 */
export interface ValidationResult {
  /**
   * Validation success flag
   */
  valid: boolean;

  /**
   * Validation errors (if any)
   */
  errors: ValidationError[];

  /**
   * Validation warnings (non-blocking)
   */
  warnings: ValidationWarning[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  /**
   * Error path in YAML/template structure
   */
  path: string;

  /**
   * Error message
   */
  message: string;

  /**
   * Error severity
   */
  severity: 'error';
}

/**
 * Validation warning details
 */
export interface ValidationWarning {
  /**
   * Warning path in YAML/template structure
   */
  path: string;

  /**
   * Warning message
   */
  message: string;

  /**
   * Warning severity
   */
  severity: 'warning';
}

/**
 * Generator options
 */
export interface GeneratorOptions {
  /**
   * Path to templates directory
   */
  templatesPath?: string;

  /**
   * Include comments in generated files
   */
  includeComments?: boolean;

  /**
   * Validate output before returning
   */
  validate?: boolean;

  /**
   * Pretty-print YAML output
   */
  prettyPrint?: boolean;
}
