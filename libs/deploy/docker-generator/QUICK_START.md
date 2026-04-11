# Docker Generator - Quick Start Guide

## Installation

```bash
# Install dependencies
npm install
# or
pnpm install
```

## Basic Usage

```typescript
import { createGenerator, ProjectConfig, EnvironmentConfig, LicenseConfig } from '@friendly-tech/deploy/docker-generator';

// Create generator instance
const generator = createGenerator();

// Configure project
const projectConfig: ProjectConfig = {
  projectId: 'my-iot-app',
  projectName: 'My IoT Application',
  version: '1.0.0',
  tier: 'professional',
  features: {
    helm: false,
    git: true,
    ollama: false,
    airgap: false,
    thirdPartyIngestion: true,
    customWidgets: false,
  },
};

// Configure environment
const envConfig: EnvironmentConfig = {
  deploymentMode: 'dedicated',
  baseDomain: 'example.com',

  // Three Friendly One-IoT DM APIs
  northboundApi: {
    url: 'https://dm.friendly-tech.com/FTACSWS_REST',
    authMethod: 'basic',
  },
  eventsApi: {
    url: 'https://dm.friendly-tech.com:8443/rest/v2',
    authMethod: 'jwt',
  },
  qoeApi: {
    url: 'https://qoe.friendly-tech.com/api',
    authMethod: 'basic',
  },

  // LLM provider
  llmProvider: {
    provider: 'anthropic',
    anthropicApiKey: 'your-api-key',
    defaultModel: 'claude-opus-4.6',
  },

  // Databases
  database: {
    postgres: {
      host: 'postgres',
      port: 5432,
      database: 'aep',
      username: 'aep_user',
      password: 'secure_password',
    },
    influxdb: {
      url: 'http://influxdb:8086',
      token: 'influx-token',
      org: 'friendly',
      bucket: 'telemetry',
    },
  },

  // Redis
  redis: {
    host: 'redis',
    port: 6379,
  },

  // Grafana
  grafana: {
    adminUsername: 'admin',
    adminPassword: 'admin_password',
  },
};

// Configure license
const licenseConfig: LicenseConfig = {
  licenseKey: 'FTECH-AEP-PRO-D-ABC123-20261231-GITTHD-HMAC',
  tenantId: 'tenant-123',
  expiryDate: new Date('2026-12-31'),
  gracePeriod: {
    enabled: true,
    duration: '24h',
  },
  heartbeatInterval: '1h',
};

// Generate Docker stack
const stack = generator.generate(projectConfig, envConfig, licenseConfig);

console.log('Generated services:', Object.keys(stack.services));
console.log('Environment template:', stack.envTemplate);
console.log('README:', stack.readme);
```

## SaaS vs Dedicated Mode

### SaaS Mode

```typescript
const envConfig: EnvironmentConfig = {
  deploymentMode: 'saas',
  baseDomain: 'aep.friendly-tech.com',
  // ... rest of config
};
```

**Characteristics:**
- No external port mappings
- Multi-tenant routing
- Cloud-based URLs
- Shared infrastructure

### Dedicated Mode

```typescript
const envConfig: EnvironmentConfig = {
  deploymentMode: 'dedicated',
  baseDomain: 'customer.example.com',
  // ... rest of config
};
```

**Characteristics:**
- All ports exposed (3000, 3001, 5432, 8086, 6379, 80, 443)
- Custom subnet (172.28.0.0/16)
- Customer-specific domain
- Self-contained deployment

## Tier Configuration

### Starter ($499/mo)

```typescript
const projectConfig: ProjectConfig = {
  tier: 'starter',
  features: {
    helm: false,
    git: false,
    ollama: false,
    airgap: false,
    thirdPartyIngestion: false,
    customWidgets: false,
  },
};
```

- Basic services only
- No Telegraf
- 1GB InfluxDB memory limit
- 100k API calls/month

### Professional ($2,499/mo)

```typescript
const projectConfig: ProjectConfig = {
  tier: 'professional',
  features: {
    helm: false,
    git: true,
    ollama: false,
    airgap: false,
    thirdPartyIngestion: true,
    customWidgets: false,
  },
};
```

- Git integration enabled
- Telegraf for third-party data
- 2GB InfluxDB memory limit
- 2M API calls/month
- 24h grace period

### Enterprise ($7,999/mo)

```typescript
const projectConfig: ProjectConfig = {
  tier: 'enterprise',
  features: {
    helm: true,
    git: true,
    ollama: true,
    airgap: true,
    thirdPartyIngestion: true,
    customWidgets: true,
  },
};
```

- All features enabled
- Ollama LLM provider
- Helm charts
- Air-gap support
- 4GB InfluxDB memory limit
- 20M API calls/month
- 7d grace period

## Using Ollama (Enterprise Only)

```typescript
const envConfig: EnvironmentConfig = {
  llmProvider: {
    provider: 'ollama',
    ollamaUrl: 'http://ollama.customer.local:11434',
    defaultModel: 'llama2',
    fallback: {
      provider: 'anthropic',
      apiKey: 'backup-key',
      model: 'claude-opus-4.6',
    },
  },
  // ... rest of config
};
```

## Third-Party Data Ingestion

```typescript
const envConfig: EnvironmentConfig = {
  thirdPartyIngestion: {
    mqtt: {
      enabled: true,
      brokers: [
        {
          url: 'mqtt://broker.example.com:1883',
          topics: ['devices/#', 'telemetry/#'],
          username: 'mqtt_user',
          password: 'mqtt_pass',
        },
      ],
    },
    http: {
      enabled: true,
      endpoints: [
        {
          url: 'https://api.external.com/data',
          method: 'POST',
          headers: {
            'Authorization': 'Bearer token',
          },
        },
      ],
    },
  },
  // ... rest of config
};
```

## Validation

### Validate Docker Compose

```typescript
import { validateDockerCompose } from '@friendly-tech/deploy/docker-generator';
import * as yaml from 'yaml';

const composeYaml = yaml.stringify(stack);
const result = validateDockerCompose(composeYaml);

if (!result.valid) {
  console.error('Validation errors:', result.errors);
}

if (result.warnings.length > 0) {
  console.warn('Warnings:', result.warnings);
}
```

### Validate Environment Template

```typescript
import { validateEnvTemplate } from '@friendly-tech/deploy/docker-generator';

const result = validateEnvTemplate(stack.envTemplate);

if (!result.valid) {
  console.error('Missing required variables:', result.errors);
}
```

### Validate Complete Stack

```typescript
import { validateDockerStack } from '@friendly-tech/deploy/docker-generator';

const result = validateDockerStack(stack);

console.log('Stack valid:', result.valid);
console.log('Errors:', result.errors);
console.log('Warnings:', result.warnings);
```

## Writing Output Files

```typescript
import * as fs from 'fs';
import * as yaml from 'yaml';

// Write docker-compose.yml
const composeYaml = yaml.stringify({
  version: stack.version,
  services: stack.services,
  networks: stack.networks,
  volumes: stack.volumes,
});
fs.writeFileSync('docker-compose.yml', composeYaml);

// Write .env.template
fs.writeFileSync('.env.template', stack.envTemplate);

// Write README.md
fs.writeFileSync('README.md', stack.readme);

console.log('Docker stack files generated successfully!');
```

## Service Definitions

The generator creates these services:

| Service | Description | Port | Tier |
|---------|-------------|------|------|
| frontend | Angular application | 3000 | All |
| grafana | Monitoring dashboards | 3001 | All |
| influxdb | Time-series database | 8086 | All |
| postgres | Relational database | 5432 | All |
| redis | Cache & rate limiting | 6379 | All |
| iot-api-proxy | Friendly DM API proxy | 8080 | All |
| license-agent | License validation | 8080 | All |
| telegraf | Third-party ingestion | - | Pro+ |
| nginx-proxy | Reverse proxy | 80, 443 | All |

## Error Handling

```typescript
try {
  const stack = generator.generate(projectConfig, envConfig, licenseConfig);
  console.log('Success!');
} catch (error) {
  if (error instanceof Error) {
    console.error('Generation failed:', error.message);

    // Common errors:
    // - "ProjectConfig: projectId is required"
    // - "Ollama provider requires Enterprise tier"
    // - "EnvironmentConfig: llmProvider.anthropicApiKey is required when provider is anthropic"
  }
}
```

## Custom Template Path

```typescript
import { DockerStackGenerator } from '@friendly-tech/deploy/docker-generator';

const generator = new DockerStackGenerator({
  templatesPath: '/custom/templates/path',
  includeComments: true,
  validate: true,
  prettyPrint: true,
});
```

## TypeScript Types

All types are fully exported and documented:

```typescript
import type {
  DeploymentMode,
  TierType,
  ProjectConfig,
  EnvironmentConfig,
  LicenseConfig,
  ServiceDefinition,
  DockerStack,
  ValidationResult,
} from '@friendly-tech/deploy/docker-generator';
```

## Next Steps

1. Generate your stack configuration
2. Validate the output
3. Write files to disk
4. Run `docker-compose up -d`
5. Monitor with `docker-compose logs -f`

For detailed deployment instructions, see the generated README.md file.

## Support

- Documentation: Module Reference v2.2 Section 11.1
- Issues: Contact Friendly Technologies support
- Email: support@friendly-tech.com
