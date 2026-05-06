/**
 * Docker Generator for Friendly AI AEP Tool
 *
 * Generates Docker Compose configurations supporting both SaaS (multi-tenant)
 * and Dedicated (self-contained) deployment modes with tier-based feature gating.
 *
 * Per Module Reference v2.2 Section 11.1:
 * - Dual-mode Docker Compose: SaaS (shared, tenant-scoped) and Dedicated (self-contained)
 * - 9 services: frontend, grafana, influxdb, postgres, telegraf, iot-api-proxy,
 *   license-agent, redis, nginx-proxy
 * - .env.template includes three API creds, LLM provider config, deployment mode
 *
 * @packageDocumentation
 */

// Export types
export type {
  DeploymentMode,
  TierType,
  ProjectConfig,
  EnvironmentConfig,
  LicenseConfig,
  ServiceDefinition,
  DockerStack,
  TemplateContext,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  GeneratorOptions,
} from './lib/types';

// Export generator class and factory
export {
  DockerStackGenerator,
  createGenerator,
  generateDockerStack,
} from './lib/docker-generator';

// Export validators
export {
  validateDockerCompose,
  validateEnvTemplate,
  validateDockerStack,
} from './lib/validator';

// Module name constant
export const MODULE_NAME = 'docker-generator';
