/**
 * Docker Compose and Environment Template Validator
 *
 * Validates generated Docker Compose YAML and .env templates for correctness,
 * required fields, service definitions, and network configuration.
 *
 * Uses YAML parsing to validate structure and performs semantic validation
 * of Docker Compose schema requirements.
 */

import * as yaml from 'yaml';
import {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  DockerStack,
} from './types';

/**
 * Required top-level Docker Compose fields
 */
const REQUIRED_COMPOSE_FIELDS = ['version', 'services'];

/**
 * Required service configuration fields
 */
const REQUIRED_SERVICE_FIELDS = ['image'];

/**
 * Valid restart policies
 */
const VALID_RESTART_POLICIES = ['always', 'unless-stopped', 'on-failure', 'no'];

/**
 * Expected service names for AEP stack
 */
const EXPECTED_SERVICES = [
  'frontend',
  'grafana',
  'influxdb',
  'postgres',
  'redis',
  'iot-api-proxy',
  'license-agent',
  'nginx-proxy',
];

/**
 * Required environment variables in .env template
 */
const REQUIRED_ENV_VARS = [
  'DEPLOYMENT_MODE',
  'PROJECT_ID',
  'LICENSE_KEY',
  'TENANT_ID',
  'NORTHBOUND_API_URL',
  'EVENTS_API_URL',
  'QOE_API_URL',
  'LLM_PROVIDER',
  'POSTGRES_DB',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'INFLUXDB_TOKEN',
  'GRAFANA_ADMIN_USER',
  'GRAFANA_ADMIN_PASSWORD',
];

/**
 * Validates a Docker Compose YAML string
 *
 * Performs structural and semantic validation including:
 * - YAML syntax validation
 * - Required field presence
 * - Service definition completeness
 * - Network and volume configuration
 * - Image tag presence
 * - Port mapping format
 * - Environment variable syntax
 *
 * @param yamlString - Docker Compose YAML content
 * @returns Validation result with errors and warnings
 */
export function validateDockerCompose(yamlString: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    // Parse YAML
    const compose = yaml.parse(yamlString);

    if (!compose || typeof compose !== 'object') {
      errors.push({
        path: 'root',
        message: 'Invalid Docker Compose structure: root must be an object',
        severity: 'error',
      });
      return { valid: false, errors, warnings };
    }

    // Validate required top-level fields
    for (const field of REQUIRED_COMPOSE_FIELDS) {
      if (!(field in compose)) {
        errors.push({
          path: field,
          message: `Required field '${field}' is missing`,
          severity: 'error',
        });
      }
    }

    // Validate version
    if (compose.version) {
      const version = String(compose.version);
      if (!version.match(/^[23]\.\d+$/)) {
        warnings.push({
          path: 'version',
          message: `Docker Compose version '${version}' may not be compatible. Recommend 3.8 or higher`,
          severity: 'warning',
        });
      }
    }

    // Validate services
    if (compose.services && typeof compose.services === 'object') {
      validateServices(compose.services, errors, warnings);
    } else {
      errors.push({
        path: 'services',
        message: 'Services must be an object',
        severity: 'error',
      });
    }

    // Validate networks
    if (compose.networks) {
      validateNetworks(compose.networks, errors, warnings);
    }

    // Validate volumes
    if (compose.volumes) {
      validateVolumes(compose.volumes, errors, warnings);
    }

    // Check for expected AEP services
    if (compose.services) {
      const serviceNames = Object.keys(compose.services);
      const missingServices = EXPECTED_SERVICES.filter(
        (name) => !serviceNames.includes(name) && name !== 'telegraf' // telegraf is optional
      );

      if (missingServices.length > 0) {
        warnings.push({
          path: 'services',
          message: `Missing expected services: ${missingServices.join(', ')}`,
          severity: 'warning',
        });
      }
    }
  } catch (err) {
    errors.push({
      path: 'root',
      message: `YAML parsing error: ${err instanceof Error ? err.message : String(err)}`,
      severity: 'error',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates Docker Compose services section
 *
 * @param services - Services object from Docker Compose
 * @param errors - Array to collect errors
 * @param warnings - Array to collect warnings
 */
function validateServices(
  services: Record<string, any>,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  for (const [serviceName, serviceConfig] of Object.entries(services)) {
    const basePath = `services.${serviceName}`;

    if (!serviceConfig || typeof serviceConfig !== 'object') {
      errors.push({
        path: basePath,
        message: 'Service configuration must be an object',
        severity: 'error',
      });
      continue;
    }

    // Validate required service fields
    for (const field of REQUIRED_SERVICE_FIELDS) {
      if (!(field in serviceConfig)) {
        errors.push({
          path: `${basePath}.${field}`,
          message: `Required field '${field}' is missing`,
          severity: 'error',
        });
      }
    }

    // Validate image format
    if (serviceConfig.image) {
      validateImageFormat(serviceConfig.image, `${basePath}.image`, errors, warnings);
    }

    // Validate ports
    if (serviceConfig.ports) {
      validatePorts(serviceConfig.ports, `${basePath}.ports`, errors, warnings);
    }

    // Validate environment variables
    if (serviceConfig.environment) {
      validateEnvironment(serviceConfig.environment, `${basePath}.environment`, errors, warnings);
    }

    // Validate volumes
    if (serviceConfig.volumes) {
      validateServiceVolumes(serviceConfig.volumes, `${basePath}.volumes`, errors, warnings);
    }

    // Validate restart policy
    if (serviceConfig.restart && !VALID_RESTART_POLICIES.includes(serviceConfig.restart)) {
      errors.push({
        path: `${basePath}.restart`,
        message: `Invalid restart policy '${serviceConfig.restart}'. Must be one of: ${VALID_RESTART_POLICIES.join(', ')}`,
        severity: 'error',
      });
    }

    // Validate depends_on
    if (serviceConfig.depends_on && serviceConfig.dependsOn) {
      warnings.push({
        path: basePath,
        message: 'Both depends_on and dependsOn are present. Use depends_on for Docker Compose compatibility',
        severity: 'warning',
      });
    }

    // Validate healthcheck
    if (serviceConfig.healthcheck) {
      validateHealthcheck(serviceConfig.healthcheck, `${basePath}.healthcheck`, errors, warnings);
    }

    // Validate resource limits
    if (serviceConfig.deploy?.resources) {
      validateResources(serviceConfig.deploy.resources, `${basePath}.deploy.resources`, errors, warnings);
    }

    // Check for healthcheck on critical services
    const criticalServices = ['postgres', 'influxdb', 'redis', 'iot-api-proxy', 'license-agent'];
    if (criticalServices.includes(serviceName) && !serviceConfig.healthcheck) {
      warnings.push({
        path: basePath,
        message: `Critical service '${serviceName}' should have a healthcheck configured`,
        severity: 'warning',
      });
    }
  }
}

/**
 * Validates Docker image format
 */
function validateImageFormat(
  image: string,
  path: string,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  if (typeof image !== 'string' || image.trim().length === 0) {
    errors.push({
      path,
      message: 'Image must be a non-empty string',
      severity: 'error',
    });
    return;
  }

  // Check for image tag
  if (!image.includes(':')) {
    warnings.push({
      path,
      message: `Image '${image}' does not specify a tag. Consider using explicit version tags`,
      severity: 'warning',
    });
  } else if (image.endsWith(':latest')) {
    warnings.push({
      path,
      message: `Image uses ':latest' tag. Consider using explicit version tags for reproducibility`,
      severity: 'warning',
    });
  }
}

/**
 * Validates port mappings
 */
function validatePorts(
  ports: any,
  path: string,
  errors: ValidationError[],
  _warnings: ValidationWarning[]
): void {
  if (!Array.isArray(ports)) {
    errors.push({
      path,
      message: 'Ports must be an array',
      severity: 'error',
    });
    return;
  }

  for (let i = 0; i < ports.length; i++) {
    const port = ports[i];
    const portPath = `${path}[${i}]`;

    if (typeof port === 'string') {
      // Validate format: "host:container" or "container"
      if (!port.match(/^(\d+:)?\d+$/)) {
        errors.push({
          path: portPath,
          message: `Invalid port format '${port}'. Expected format: 'host:container' or 'container'`,
          severity: 'error',
        });
      }
    } else if (typeof port === 'number') {
      // Plain number is valid
      continue;
    } else {
      errors.push({
        path: portPath,
        message: 'Port must be a string or number',
        severity: 'error',
      });
    }
  }
}

/**
 * Validates environment variables
 */
function validateEnvironment(
  environment: any,
  path: string,
  errors: ValidationError[],
  _warnings: ValidationWarning[]
): void {
  if (Array.isArray(environment)) {
    // Array format: ["KEY=value", ...]
    for (let i = 0; i < environment.length; i++) {
      const envVar = environment[i];
      if (typeof envVar !== 'string' || !envVar.includes('=')) {
        errors.push({
          path: `${path}[${i}]`,
          message: `Invalid environment variable format. Expected 'KEY=value', got '${envVar}'`,
          severity: 'error',
        });
      }
    }
  } else if (typeof environment === 'object' && environment !== null) {
    // Object format: { KEY: "value", ... }
    for (const [key, value] of Object.entries(environment)) {
      if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        errors.push({
          path: `${path}.${key}`,
          message: `Environment variable value must be string, number, or boolean`,
          severity: 'error',
        });
      }
    }
  } else {
    errors.push({
      path,
      message: 'Environment must be an array or object',
      severity: 'error',
    });
  }
}

/**
 * Validates service volume mounts
 */
function validateServiceVolumes(
  volumes: any,
  path: string,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  if (!Array.isArray(volumes)) {
    errors.push({
      path,
      message: 'Volumes must be an array',
      severity: 'error',
    });
    return;
  }

  for (let i = 0; i < volumes.length; i++) {
    const volume = volumes[i];
    const volumePath = `${path}[${i}]`;

    if (typeof volume === 'string') {
      // Validate format: "source:target[:mode]"
      const parts = volume.split(':');
      if (parts.length < 2 || parts.length > 3) {
        errors.push({
          path: volumePath,
          message: `Invalid volume format '${volume}'. Expected 'source:target[:mode]'`,
          severity: 'error',
        });
      }

      // Check for absolute paths in dedicated mode
      if (parts[0] && parts[0].startsWith('./')) {
        warnings.push({
          path: volumePath,
          message: `Relative volume path '${parts[0]}' may cause issues in production`,
          severity: 'warning',
        });
      }
    } else if (typeof volume === 'object') {
      // Long syntax format
      if (!volume.target) {
        errors.push({
          path: volumePath,
          message: 'Volume target is required in long syntax',
          severity: 'error',
        });
      }
    } else {
      errors.push({
        path: volumePath,
        message: 'Volume must be a string or object',
        severity: 'error',
      });
    }
  }
}

/**
 * Validates healthcheck configuration
 */
function validateHealthcheck(
  healthcheck: any,
  path: string,
  errors: ValidationError[],
  _warnings: ValidationWarning[]
): void {
  if (typeof healthcheck !== 'object' || healthcheck === null) {
    errors.push({
      path,
      message: 'Healthcheck must be an object',
      severity: 'error',
    });
    return;
  }

  if (!healthcheck.test) {
    errors.push({
      path: `${path}.test`,
      message: 'Healthcheck test is required',
      severity: 'error',
    });
  } else if (!Array.isArray(healthcheck.test) && typeof healthcheck.test !== 'string') {
    errors.push({
      path: `${path}.test`,
      message: 'Healthcheck test must be a string or array',
      severity: 'error',
    });
  }

  // Validate interval format
  if (healthcheck.interval && !isValidDuration(healthcheck.interval)) {
    errors.push({
      path: `${path}.interval`,
      message: `Invalid duration format '${healthcheck.interval}'. Expected format: '30s', '1m', etc.`,
      severity: 'error',
    });
  }

  // Validate timeout format
  if (healthcheck.timeout && !isValidDuration(healthcheck.timeout)) {
    errors.push({
      path: `${path}.timeout`,
      message: `Invalid duration format '${healthcheck.timeout}'. Expected format: '10s', '1m', etc.`,
      severity: 'error',
    });
  }
}

/**
 * Validates resource limits
 */
function validateResources(
  resources: any,
  path: string,
  errors: ValidationError[],
  _warnings: ValidationWarning[]
): void {
  if (typeof resources !== 'object' || resources === null) {
    errors.push({
      path,
      message: 'Resources must be an object',
      severity: 'error',
    });
    return;
  }

  // Validate limits
  if (resources.limits) {
    if (resources.limits.memory && !isValidMemorySize(resources.limits.memory)) {
      errors.push({
        path: `${path}.limits.memory`,
        message: `Invalid memory size '${resources.limits.memory}'. Expected format: '1G', '512M', etc.`,
        severity: 'error',
      });
    }

    if (resources.limits.cpus && typeof resources.limits.cpus !== 'string' && typeof resources.limits.cpus !== 'number') {
      errors.push({
        path: `${path}.limits.cpus`,
        message: 'CPU limit must be a string or number',
        severity: 'error',
      });
    }
  }
}

/**
 * Validates networks section
 */
function validateNetworks(
  networks: Record<string, any>,
  errors: ValidationError[],
  _warnings: ValidationWarning[]
): void {
  for (const [networkName, networkConfig] of Object.entries(networks)) {
    const basePath = `networks.${networkName}`;

    if (networkConfig && typeof networkConfig !== 'object') {
      errors.push({
        path: basePath,
        message: 'Network configuration must be an object',
        severity: 'error',
      });
      continue;
    }

    // Validate driver
    if (networkConfig.driver && typeof networkConfig.driver !== 'string') {
      errors.push({
        path: `${basePath}.driver`,
        message: 'Network driver must be a string',
        severity: 'error',
      });
    }
  }
}

/**
 * Validates volumes section
 */
function validateVolumes(
  volumes: Record<string, any>,
  errors: ValidationError[],
  _warnings: ValidationWarning[]
): void {
  for (const [volumeName, volumeConfig] of Object.entries(volumes)) {
    const basePath = `volumes.${volumeName}`;

    if (volumeConfig !== null && typeof volumeConfig !== 'object') {
      errors.push({
        path: basePath,
        message: 'Volume configuration must be an object or null',
        severity: 'error',
      });
      continue;
    }

    // Validate driver
    if (volumeConfig?.driver && typeof volumeConfig.driver !== 'string') {
      errors.push({
        path: `${basePath}.driver`,
        message: 'Volume driver must be a string',
        severity: 'error',
      });
    }
  }
}

/**
 * Validates .env template file content
 *
 * Checks for:
 * - Required environment variables
 * - Variable name format (uppercase, underscores)
 * - No duplicate variable names
 * - Valid value syntax
 *
 * @param envString - .env template content
 * @returns Validation result with errors and warnings
 */
export function validateEnvTemplate(envString: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const declaredVars = new Set<string>();
  const lines = envString.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNumber = i + 1;

    // Skip empty lines and comments
    if (line === '' || line.startsWith('#')) {
      continue;
    }

    // Parse variable declaration
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match) {
      // Check if it looks like a variable but has incorrect format
      if (line.includes('=')) {
        errors.push({
          path: `line ${lineNumber}`,
          message: `Invalid environment variable format: '${line}'. Variable names must be uppercase with underscores`,
          severity: 'error',
        });
      } else {
        warnings.push({
          path: `line ${lineNumber}`,
          message: `Unexpected content: '${line}'`,
          severity: 'warning',
        });
      }
      continue;
    }

    const [, varName, varValue] = match;

    // Check for duplicate declarations
    if (declaredVars.has(varName)) {
      errors.push({
        path: varName,
        message: `Duplicate environment variable '${varName}' at line ${lineNumber}`,
        severity: 'error',
      });
    } else {
      declaredVars.add(varName);
    }

    // Check if value contains unescaped quotes
    if (varValue && (varValue.includes('"') || varValue.includes("'"))) {
      if (!varValue.startsWith('"') && !varValue.startsWith("'")) {
        warnings.push({
          path: varName,
          message: `Value may need to be quoted at line ${lineNumber}`,
          severity: 'warning',
        });
      }
    }
  }

  // Check for required variables
  for (const requiredVar of REQUIRED_ENV_VARS) {
    if (!declaredVars.has(requiredVar)) {
      errors.push({
        path: requiredVar,
        message: `Required environment variable '${requiredVar}' is missing`,
        severity: 'error',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates a complete DockerStack object
 *
 * @param stack - Complete Docker stack configuration
 * @returns Validation result with errors and warnings
 */
export function validateDockerStack(stack: DockerStack): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Validate docker-compose.yml
  if (!stack.composeYml) {
    errors.push({
      path: 'composeYml',
      message: 'docker-compose.yml content is required',
      severity: 'error',
    });
  } else {
    const composeValidation = validateDockerCompose(stack.composeYml);
    errors.push(...composeValidation.errors);
    warnings.push(...composeValidation.warnings);
  }

  // Validate docker-compose.prod.yml
  if (!stack.composeProYml) {
    errors.push({
      path: 'composeProYml',
      message: 'docker-compose.prod.yml content is required',
      severity: 'error',
    });
  } else {
    const prodComposeValidation = validateDockerCompose(stack.composeProYml);
    errors.push(...prodComposeValidation.errors);
    warnings.push(...prodComposeValidation.warnings);
  }

  // Validate environment template
  if (!stack.envTemplate) {
    errors.push({
      path: 'envTemplate',
      message: 'Environment template is required',
      severity: 'error',
    });
  } else {
    const envValidation = validateEnvTemplate(stack.envTemplate);
    errors.push(...envValidation.errors);
    warnings.push(...envValidation.warnings);
  }

  // Validate nginx configuration
  if (!stack.nginxConf) {
    errors.push({
      path: 'nginxConf',
      message: 'Nginx configuration is required',
      severity: 'error',
    });
  }

  // Validate Dockerfiles
  if (!stack.dockerfiles || Object.keys(stack.dockerfiles).length === 0) {
    warnings.push({
      path: 'dockerfiles',
      message: 'No Dockerfiles provided - using base images only',
      severity: 'warning',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Checks if a string is a valid duration format (e.g., "30s", "1m", "2h")
 */
function isValidDuration(duration: string): boolean {
  return /^\d+[smh]$/.test(duration);
}

/**
 * Checks if a string is a valid memory size format (e.g., "1G", "512M", "1024K")
 */
function isValidMemorySize(size: string): boolean {
  return /^\d+[KMG]$/.test(size);
}
