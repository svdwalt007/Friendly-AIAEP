# Template Usage Example

## How the Templates Work

The Handlebars templates in `src/lib/templates/` are used by the `DockerStackGenerator` class to generate deployment configurations.

## Example: Generating a Stack

```typescript
import { DockerStackGenerator } from '@friendly-aiaep/docker-generator';

const generator = new DockerStackGenerator();

const stack = generator.generate(
  // Project Configuration
  {
    projectId: 'demo-project-123',
    projectName: 'IoT Monitoring Dashboard',
    version: '1.0.0',
    tier: 'professional',
    features: {
      helm: false,
      git: true,
      ollama: false,
      airgap: false,
      thirdPartyIngestion: true,  // Professional+ feature
      customWidgets: false,
    },
  },
  // Environment Configuration
  {
    deploymentMode: 'dedicated',
    baseDomain: 'example.com',

    // Three Friendly APIs
    northboundApi: {
      url: 'https://api.friendly.example.com/northbound',
      authMethod: 'basic',
    },
    eventsApi: {
      url: 'https://api.friendly.example.com/events',
      authMethod: 'apikey',
    },
    qoeApi: {
      url: 'https://api.friendly.example.com/qoe',
      authMethod: 'basic',
    },

    // LLM Provider
    llmProvider: {
      provider: 'anthropic',
      defaultModel: 'claude-3-5-sonnet-20241022',
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    },

    // Databases
    database: {
      postgres: {
        host: 'postgres',
        port: 5432,
        database: 'aep',
        username: 'aep_user',
      },
      influxdb: {
        url: 'http://influxdb:46101',
        org: 'friendly',
        bucket: 'iot_data',
      },
    },

    // Redis
    redis: {
      host: 'redis',
      port: 6379,
      password: true,  // Will prompt for password in env
    },

    // Grafana
    grafana: {
      adminUsername: 'admin',
    },

    // Third-party ingestion (Professional+ only)
    thirdPartyIngestion: {
      mqtt: {
        enabled: true,
        broker: 'mqtt.example.com:1883',
        topic: 'sensors/#',
        username: 'mqtt_user',
      },
      http: {
        enabled: true,
        endpoint: 'https://external-api.example.com/data',
        method: 'GET',
        interval: '60s',
      },
    },
  },
  // License Configuration
  {
    licenseKey: process.env.LICENSE_KEY,
    tenantId: 'tenant-abc-123',
    heartbeatInterval: '1h',
    gracePeriod: {
      enabled: true,
      duration: '72h',
    },
  }
);

// The generated stack contains:
console.log(stack.services);       // All service definitions
console.log(stack.networks);       // Network configuration
console.log(stack.volumes);        // Volume definitions
console.log(stack.envTemplate);    // .env.template content
console.log(stack.readme);         // README.md content
```

## Template Context Example

When the templates are rendered, they receive a context object:

```javascript
{
  // Project info
  project: {
    projectId: 'demo-project-123',
    projectName: 'IoT Monitoring Dashboard',
    version: '1.0.0',
    tier: 'professional',
    features: { ... }
  },

  // Environment config
  environment: {
    deploymentMode: 'dedicated',
    baseDomain: 'example.com',
    northboundApi: { ... },
    eventsApi: { ... },
    qoeApi: { ... },
    llmProvider: { ... },
    database: { ... },
    redis: { ... },
    grafana: { ... },
    thirdPartyIngestion: { ... }
  },

  // License config
  license: {
    tenantId: 'tenant-abc-123',
    heartbeatInterval: '1h',
    gracePeriod: { ... }
  },

  // Computed flags
  isSaas: false,
  isDedicated: true,
  isStarter: false,
  isProfessional: true,
  isEnterprise: false,
  hasThirdPartyIngestion: true,
  hasOllama: false,
  hasAirgap: false,
  hasGit: true,
  hasHelm: false,
  hasCustomWidgets: false,

  // Metadata
  metadata: {
    generatedAt: '2026-04-11T12:40:00.000Z',
    projectId: 'demo-project-123',
    deploymentMode: 'dedicated',
    tier: 'professional'
  }
}
```

## Template Rendering Examples

### 1. Conditional Services (docker-compose.yml.hbs)

```handlebars
{{#if hasThirdPartyIngestion}}
  # Telegraf Service (Professional+ Only)
  telegraf:
    image: telegraf:1.28-alpine
    ...
{{/if}}
```

**Result for Professional tier:** Service is included

**Result for Starter tier:** Service is excluded

### 2. Tier-Based Resources (docker-compose.prod.yml.hbs)

```handlebars
deploy:
  resources:
    limits:
{{#if isEnterprise}}
      memory: 4G
      cpus: '2.0'
{{else}}{{#if isProfessional}}
      memory: 2G
      cpus: '1.0'
{{else}}
      memory: 1G
      cpus: '0.5'
{{/if}}{{/if}}
```

**Result for Professional tier:**
```yaml
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '1.0'
```

### 3. Conditional Environment Variables (env.template.hbs)

```handlebars
{{#if (eq environment.llmProvider.provider 'anthropic')}}
# Anthropic API Key
ANTHROPIC_API_KEY=
{{/if}}

{{#if isEnterprise}}
{{#if (eq environment.llmProvider.provider 'ollama')}}
# Ollama Configuration (Enterprise only)
OLLAMA_URL={{environment.llmProvider.ollamaUrl}}
{{/if}}
{{/if}}
```

**Result for Anthropic provider:**
```env
# Anthropic API Key
ANTHROPIC_API_KEY=
```

**Result for Enterprise + Ollama:**
```env
# Ollama Configuration (Enterprise only)
OLLAMA_URL=http://ollama:11434
```

### 4. Deployment Mode Routing (nginx-default.conf.hbs)

```handlebars
{{#if isSaas}}
      API_GATEWAY_URL: https://api.${BASE_DOMAIN}
{{else}}
      API_GATEWAY_URL: http://nginx-proxy:80/api
{{/if}}
```

**Result for SaaS mode:**
```yaml
API_GATEWAY_URL: https://api.${BASE_DOMAIN}
```

**Result for Dedicated mode:**
```yaml
API_GATEWAY_URL: http://nginx-proxy:80/api
```

## Generated Files

After rendering, the generator produces:

1. **docker-compose.yml** - Base configuration with all enabled services
2. **docker-compose.prod.yml** - Production overrides
3. **.env.template** - Environment variable template with comments
4. **nginx/default.conf** - Nginx reverse proxy configuration
5. **README.md** - Deployment guide with tier-specific instructions

## Deployment

```bash
# 1. Configure environment
cp .env.template .env
vim .env  # Fill in credentials

# 2. Start services (development)
docker-compose up -d

# 3. Start services (production)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 4. Verify health
docker-compose ps
docker-compose logs -f

# 5. Access services
# Frontend: http://localhost:45001
# Grafana: http://localhost:46000
# API: http://localhost:80/api
```

## Tier Comparison

| Feature | Starter | Professional | Enterprise |
|---------|---------|--------------|------------|
| Core Services | ✅ 8 services | ✅ 8 services | ✅ 8 services |
| Telegraf Ingestion | ❌ | ✅ | ✅ |
| Ollama Support | ❌ | ❌ | ✅ |
| Memory Limits | 512M-1G | 1G-2G | 2G-4G |
| CPU Limits | 0.5-1.0 | 1.0-2.0 | 2.0-4.0 |
| Rate Limit | 100k/mo | 2M/mo | 20M/mo |
| Third-Party APIs | ❌ | ✅ | ✅ |

## Notes

- Templates are automatically loaded from `src/lib/templates/`
- All templates use `.hbs` extension
- Context is built in `buildTemplateContext()` method
- Handlebars helpers are registered in `registerHelpers()` method
- Templates are cached after first load for performance
