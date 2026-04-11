/**
 * Docker Stack Generator - Comprehensive Test Suite
 *
 * Tests cover:
 * - YAML validation
 * - Template rendering for all configurations
 * - Tier-based feature gating
 * - Deployment mode differences (SaaS vs Dedicated)
 * - Service definitions and networking
 * - Environment template generation
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as yaml from 'yaml';
import {
  DockerStackGenerator,
  createGenerator,
} from './docker-generator';
import {
  ProjectConfig,
  EnvironmentConfig,
  LicenseConfig,
  TierType,
  DeploymentMode,
  LLMProvider,
  DockerStack,
} from './types';
import { validateDockerStack } from './validator';

describe('DockerStackGenerator', () => {
  let generator: DockerStackGenerator;
  let baseProjectConfig: ProjectConfig;
  let baseEnvConfig: EnvironmentConfig;
  let baseLicenseConfig: LicenseConfig;

  beforeEach(() => {
    generator = createGenerator();

    baseProjectConfig = {
      projectId: 'test-project-123',
      name: 'test-aep',
      version: '1.0.0',
      tier: TierType.PROFESSIONAL,
      features: {
        gitPush: true,
        helmOutput: true,
        ollamaLLM: false,
        airGap: false,
        thirdPartyIngestion: true,
        customWidgets: true,
        multiEnvPromotion: true,
      },
    };

    baseEnvConfig = {
      deploymentMode: DeploymentMode.MULTI_TENANT,
      friendlyApis: {
        northbound: {
          url: 'https://demo.friendly.com:8443',
          username: 'admin',
          apiKey: 'test-api-key',
        },
        events: {
          url: 'https://demo.friendly.com:8443',
          username: 'admin',
          apiKey: 'test-api-key',
        },
        qoe: {
          url: 'https://demo.friendly.com:8443',
          username: 'admin',
          apiKey: 'test-api-key',
        },
      },
      llm: {
        provider: LLMProvider.ANTHROPIC,
        model: 'claude-opus-4.6',
        apiKey: 'sk-test-123',
      },
      database: {
        host: 'postgres',
        port: 5432,
        name: 'aep_db',
        user: 'aep_user',
        password: 'test-password',
      },
      redis: {
        host: 'redis',
        port: 6379,
        password: 'redis-password',
      },
      ports: {
        frontend: 4200,
        apiGateway: 3000,
        grafana: 3001,
        influxdb: 8086,
        postgres: 5432,
        redis: 6379,
      },
    };

    baseLicenseConfig = {
      licenseKey: 'FTECH-AEP-PRO-SAAS-ABC123-1735689600-13-HMAC123',
      validationUrl: 'http://license-agent:4000/validate',
    };
  });

  describe('Basic Functionality', () => {
    it('should create a generator instance', () => {
      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(DockerStackGenerator);
    });

    it('should create generator using factory function', () => {
      const gen = createGenerator();
      expect(gen).toBeDefined();
      expect(gen).toBeInstanceOf(DockerStackGenerator);
    });

    it('should accept custom templates path', () => {
      const customGen = createGenerator({ templatesPath: '/custom/path' });
      expect(customGen).toBeDefined();
    });
  });

  describe('Docker Stack Generation', () => {
    it('should generate complete Docker stack', () => {
      const stack = generator.generate(
        baseProjectConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      expect(stack).toBeDefined();
      expect(stack.composeYml).toBeDefined();
      expect(stack.composeProYml).toBeDefined();
      expect(stack.envTemplate).toBeDefined();
      expect(stack.nginxConf).toBeDefined();
      expect(stack.dockerfiles).toBeDefined();
      expect(stack.readme).toBeDefined();
    });

    it('should generate valid YAML for docker-compose.yml', () => {
      const stack = generator.generate(
        baseProjectConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      expect(() => yaml.parse(stack.composeYml)).not.toThrow();

      const parsed = yaml.parse(stack.composeYml);
      expect(parsed.version).toBe('3.9');
      expect(parsed.services).toBeDefined();
      expect(parsed.networks).toBeDefined();
      expect(parsed.volumes).toBeDefined();
    });

    it('should generate valid YAML for docker-compose.prod.yml', () => {
      const stack = generator.generate(
        baseProjectConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      expect(() => yaml.parse(stack.composeProYml)).not.toThrow();

      const parsed = yaml.parse(stack.composeProYml);
      expect(parsed.version).toBe('3.9');
      expect(parsed.services).toBeDefined();
    });

    it('should pass validation', () => {
      const stack = generator.generate(
        baseProjectConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      const validation = validateDockerStack(stack);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Service Definitions', () => {
    it('should include all core services', () => {
      const stack = generator.generate(
        baseProjectConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      const parsed = yaml.parse(stack.composeYml);
      const serviceNames = Object.keys(parsed.services);

      expect(serviceNames).toContain('frontend');
      expect(serviceNames).toContain('grafana');
      expect(serviceNames).toContain('influxdb');
      expect(serviceNames).toContain('postgres');
      expect(serviceNames).toContain('redis');
      expect(serviceNames).toContain('iot-api-proxy');
      expect(serviceNames).toContain('license-agent');
      expect(serviceNames).toContain('nginx-proxy');
    });

    it('should include telegraf for Professional tier with third-party ingestion', () => {
      const stack = generator.generate(
        baseProjectConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      const parsed = yaml.parse(stack.composeYml);
      expect(parsed.services.telegraf).toBeDefined();
    });

    it('should not include telegraf for Starter tier', () => {
      const starterConfig = {
        ...baseProjectConfig,
        tier: TierType.STARTER,
        features: {
          ...baseProjectConfig.features,
          thirdPartyIngestion: false,
        },
      };

      const stack = generator.generate(
        starterConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      const parsed = yaml.parse(stack.composeYml);
      expect(parsed.services.telegraf).toBeUndefined();
    });

    it('should configure services with correct images', () => {
      const stack = generator.generate(
        baseProjectConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      const parsed = yaml.parse(stack.composeYml);

      expect(parsed.services.grafana.image).toContain('grafana/grafana-oss');
      expect(parsed.services.influxdb.image).toContain('influxdb');
      expect(parsed.services.postgres.image).toContain('postgres');
      expect(parsed.services.redis.image).toContain('redis');
    });

    it('should configure restart policies', () => {
      const stack = generator.generate(
        baseProjectConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      const parsed = yaml.parse(stack.composeYml);

      expect(parsed.services.grafana.restart).toBe('unless-stopped');
      expect(parsed.services.postgres.restart).toBe('unless-stopped');
      expect(parsed.services.redis.restart).toBe('unless-stopped');
    });
  });

  describe('Tier-Based Features', () => {
    it('should configure Starter tier with minimal features', () => {
      const starterConfig: ProjectConfig = {
        ...baseProjectConfig,
        tier: TierType.STARTER,
        features: {
          gitPush: false,
          helmOutput: false,
          ollamaLLM: false,
          airGap: false,
          thirdPartyIngestion: false,
          customWidgets: false,
          multiEnvPromotion: false,
        },
      };

      const stack = generator.generate(
        starterConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      const parsed = yaml.parse(stack.composeYml);
      expect(parsed.services.telegraf).toBeUndefined();
    });

    it('should configure Professional tier with enhanced features', () => {
      const proConfig: ProjectConfig = {
        ...baseProjectConfig,
        tier: TierType.PROFESSIONAL,
        features: {
          gitPush: true,
          helmOutput: false,
          ollamaLLM: false,
          airGap: false,
          thirdPartyIngestion: true,
          customWidgets: true,
          multiEnvPromotion: true,
        },
      };

      const stack = generator.generate(
        proConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      const parsed = yaml.parse(stack.composeYml);
      expect(parsed.services.telegraf).toBeDefined();
    });

    it('should configure Enterprise tier with all features', () => {
      const enterpriseConfig: ProjectConfig = {
        ...baseProjectConfig,
        tier: TierType.ENTERPRISE,
        features: {
          gitPush: true,
          helmOutput: true,
          ollamaLLM: true,
          airGap: true,
          thirdPartyIngestion: true,
          customWidgets: true,
          multiEnvPromotion: true,
        },
      };

      const enterpriseEnv: EnvironmentConfig = {
        ...baseEnvConfig,
        llm: {
          provider: LLMProvider.OLLAMA,
          model: 'llama3.1:8b',
        },
      };

      const stack = generator.generate(
        enterpriseConfig,
        enterpriseEnv,
        baseLicenseConfig
      );

      const parsed = yaml.parse(stack.composeYml);
      expect(parsed.services.ollama).toBeDefined();
      expect(parsed.services.telegraf).toBeDefined();
    });

    it('should apply tier-based resource limits', () => {
      const stack = generator.generate(
        baseProjectConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      const prodParsed = yaml.parse(stack.composeProYml);

      // Professional tier should have mid-range limits
      expect(prodParsed.services.postgres.deploy.resources.limits.memory).toBeDefined();
    });
  });

  describe('Deployment Mode', () => {
    it('should configure multi-tenant mode correctly', () => {
      const stack = generator.generate(
        baseProjectConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      expect(stack.envTemplate).toContain('DEPLOYMENT_MODE=multi-tenant');

      const parsed = yaml.parse(stack.composeYml);
      expect(parsed.services['iot-api-proxy'].environment).toContain('DEPLOYMENT_MODE=multi-tenant');
    });

    it('should configure dedicated mode correctly', () => {
      const dedicatedEnv: EnvironmentConfig = {
        ...baseEnvConfig,
        deploymentMode: DeploymentMode.DEDICATED,
      };

      const stack = generator.generate(
        baseProjectConfig,
        dedicatedEnv,
        baseLicenseConfig
      );

      expect(stack.envTemplate).toContain('DEPLOYMENT_MODE=dedicated');

      const parsed = yaml.parse(stack.composeYml);
      expect(parsed.services['iot-api-proxy'].environment).toContain('DEPLOYMENT_MODE=dedicated');
    });

    it('should expose more ports in dedicated mode', () => {
      const dedicatedEnv: EnvironmentConfig = {
        ...baseEnvConfig,
        deploymentMode: DeploymentMode.DEDICATED,
      };

      const multiTenantStack = generator.generate(
        baseProjectConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      const dedicatedStack = generator.generate(
        baseProjectConfig,
        dedicatedEnv,
        baseLicenseConfig
      );

      const mtParsed = yaml.parse(multiTenantStack.composeYml);
      const dedParsed = yaml.parse(dedicatedStack.composeYml);

      // Dedicated mode should expose database ports
      expect(dedParsed.services.postgres.ports).toBeDefined();
      expect(dedParsed.services.redis.ports).toBeDefined();
    });

    it('should configure custom subnets in dedicated mode', () => {
      const dedicatedEnv: EnvironmentConfig = {
        ...baseEnvConfig,
        deploymentMode: DeploymentMode.DEDICATED,
      };

      const stack = generator.generate(
        baseProjectConfig,
        dedicatedEnv,
        baseLicenseConfig
      );

      const parsed = yaml.parse(stack.composeYml);
      expect(parsed.networks['aep-network'].ipam).toBeDefined();
    });
  });

  describe('Environment Template', () => {
    it('should generate environment template with all required variables', () => {
      const stack = generator.generate(
        baseProjectConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      expect(stack.envTemplate).toContain('PROJECT_NAME=');
      expect(stack.envTemplate).toContain('VERSION=');
      expect(stack.envTemplate).toContain('DEPLOYMENT_MODE=');
      expect(stack.envTemplate).toContain('TIER=');
      expect(stack.envTemplate).toContain('FRIENDLY_NORTHBOUND_URL=');
      expect(stack.envTemplate).toContain('FRIENDLY_EVENTS_URL=');
      expect(stack.envTemplate).toContain('FRIENDLY_QOE_URL=');
      expect(stack.envTemplate).toContain('LLM_PROVIDER=');
      expect(stack.envTemplate).toContain('POSTGRES_HOST=');
      expect(stack.envTemplate).toContain('REDIS_HOST=');
      expect(stack.envTemplate).toContain('GRAFANA_ADMIN_USER=');
    });

    it('should include Ollama variables for Enterprise tier', () => {
      const enterpriseConfig: ProjectConfig = {
        ...baseProjectConfig,
        tier: TierType.ENTERPRISE,
        features: {
          ...baseProjectConfig.features,
          ollamaLLM: true,
        },
      };

      const enterpriseEnv: EnvironmentConfig = {
        ...baseEnvConfig,
        llm: {
          provider: LLMProvider.OLLAMA,
          model: 'llama3.1:8b',
        },
      };

      const stack = generator.generate(
        enterpriseConfig,
        enterpriseEnv,
        baseLicenseConfig
      );

      expect(stack.envTemplate).toContain('OLLAMA_BASE_URL=');
      expect(stack.envTemplate).toContain('OLLAMA_MODEL=');
    });

    it('should not include Ollama variables for non-Enterprise tiers', () => {
      const stack = generator.generate(
        baseProjectConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      expect(stack.envTemplate).not.toContain('OLLAMA_BASE_URL=');
    });
  });

  describe('Nginx Configuration', () => {
    it('should generate nginx configuration', () => {
      const stack = generator.generate(
        baseProjectConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      expect(stack.nginxConf).toBeDefined();
      expect(stack.nginxConf.length).toBeGreaterThan(0);
    });

    it('should include reverse proxy routes', () => {
      const stack = generator.generate(
        baseProjectConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      expect(stack.nginxConf).toContain('location /api/');
      expect(stack.nginxConf).toContain('location /grafana/');
      expect(stack.nginxConf).toContain('location /ws/');
    });

    it('should configure WebSocket support', () => {
      const stack = generator.generate(
        baseProjectConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      expect(stack.nginxConf).toContain('Upgrade');
      expect(stack.nginxConf).toContain('Connection');
    });
  });

  describe('Dockerfile Generation', () => {
    it('should generate frontend Dockerfile', () => {
      const stack = generator.generate(
        baseProjectConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      expect(stack.dockerfiles.frontend).toBeDefined();
      expect(stack.dockerfiles.frontend).toContain('FROM node:20-alpine');
      expect(stack.dockerfiles.frontend).toContain('nginx');
    });

    it('should generate iot-api-proxy Dockerfile', () => {
      const stack = generator.generate(
        baseProjectConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      expect(stack.dockerfiles['iot-api-proxy']).toBeDefined();
      expect(stack.dockerfiles['iot-api-proxy']).toContain('FROM node:20-alpine');
      expect(stack.dockerfiles['iot-api-proxy']).toContain('aep-api-gateway');
    });

    it('should generate telegraf Dockerfile for Professional tier', () => {
      const stack = generator.generate(
        baseProjectConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      expect(stack.dockerfiles.telegraf).toBeDefined();
      expect(stack.dockerfiles.telegraf).toContain('FROM telegraf:1.29-alpine');
    });

    it('should not generate telegraf Dockerfile for Starter tier', () => {
      const starterConfig: ProjectConfig = {
        ...baseProjectConfig,
        tier: TierType.STARTER,
        features: {
          ...baseProjectConfig.features,
          thirdPartyIngestion: false,
        },
      };

      const stack = generator.generate(
        starterConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      expect(stack.dockerfiles.telegraf).toBeUndefined();
    });
  });

  describe('README Generation', () => {
    it('should generate README documentation', () => {
      const stack = generator.generate(
        baseProjectConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      expect(stack.readme).toBeDefined();
      expect(stack.readme).toContain('# Docker Deployment');
      expect(stack.readme).toContain('test-aep');
      expect(stack.readme).toContain('1.0.0');
    });

    it('should include deployment mode in README', () => {
      const stack = generator.generate(
        baseProjectConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      expect(stack.readme).toContain('multi-tenant');
    });

    it('should include tier information in README', () => {
      const stack = generator.generate(
        baseProjectConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      expect(stack.readme).toContain('professional');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid project configuration', () => {
      const invalidConfig = {
        ...baseProjectConfig,
        name: '',
      };

      expect(() =>
        generator.generate(invalidConfig, baseEnvConfig, baseLicenseConfig)
      ).toThrow();
    });

    it('should throw error for invalid deployment mode', () => {
      const invalidEnv = {
        ...baseEnvConfig,
        deploymentMode: 'invalid' as DeploymentMode,
      };

      expect(() =>
        generator.generate(baseProjectConfig, invalidEnv, baseLicenseConfig)
      ).toThrow();
    });

    it('should throw error for missing required configuration', () => {
      const invalidEnv = {
        ...baseEnvConfig,
        friendlyApis: undefined as any,
      };

      expect(() =>
        generator.generate(baseProjectConfig, invalidEnv, baseLicenseConfig)
      ).toThrow();
    });
  });

  describe('LLM Provider Configuration', () => {
    it('should configure Anthropic LLM provider', () => {
      const stack = generator.generate(
        baseProjectConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      expect(stack.envTemplate).toContain('LLM_PROVIDER=anthropic');
      expect(stack.envTemplate).toContain('ANTHROPIC_API_KEY=');
    });

    it('should configure OpenAI LLM provider', () => {
      const openaiEnv: EnvironmentConfig = {
        ...baseEnvConfig,
        llm: {
          provider: LLMProvider.OPENAI,
          model: 'gpt-4',
          apiKey: 'sk-openai-123',
        },
      };

      const stack = generator.generate(
        baseProjectConfig,
        openaiEnv,
        baseLicenseConfig
      );

      expect(stack.envTemplate).toContain('LLM_PROVIDER=openai');
      expect(stack.envTemplate).toContain('OPENAI_API_KEY=');
    });

    it('should configure Ollama LLM provider for Enterprise tier', () => {
      const enterpriseConfig: ProjectConfig = {
        ...baseProjectConfig,
        tier: TierType.ENTERPRISE,
        features: {
          ...baseProjectConfig.features,
          ollamaLLM: true,
        },
      };

      const ollamaEnv: EnvironmentConfig = {
        ...baseEnvConfig,
        llm: {
          provider: LLMProvider.OLLAMA,
          model: 'llama3.1:8b',
        },
      };

      const stack = generator.generate(
        enterpriseConfig,
        ollamaEnv,
        baseLicenseConfig
      );

      expect(stack.envTemplate).toContain('LLM_PROVIDER=ollama');
      expect(stack.envTemplate).toContain('OLLAMA_MODEL=llama3.1:8b');
    });
  });

  describe('Network Configuration', () => {
    it('should configure bridge network for multi-tenant mode', () => {
      const stack = generator.generate(
        baseProjectConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      const parsed = yaml.parse(stack.composeYml);
      expect(parsed.networks['aep-network'].driver).toBe('bridge');
    });

    it('should configure custom subnet for dedicated mode', () => {
      const dedicatedEnv: EnvironmentConfig = {
        ...baseEnvConfig,
        deploymentMode: DeploymentMode.DEDICATED,
      };

      const stack = generator.generate(
        baseProjectConfig,
        dedicatedEnv,
        baseLicenseConfig
      );

      const parsed = yaml.parse(stack.composeYml);
      expect(parsed.networks['aep-network'].ipam.config).toBeDefined();
    });
  });

  describe('Volume Configuration', () => {
    it('should configure persistent volumes', () => {
      const stack = generator.generate(
        baseProjectConfig,
        baseEnvConfig,
        baseLicenseConfig
      );

      const parsed = yaml.parse(stack.composeYml);
      expect(parsed.volumes['grafana-data']).toBeDefined();
      expect(parsed.volumes['influx-data']).toBeDefined();
      expect(parsed.volumes['postgres-data']).toBeDefined();
      expect(parsed.volumes['redis-data']).toBeDefined();
    });
  });
});
