/**
 * Docker Generator
 *
 * Generates Docker Compose configurations for Friendly AI AEP Tool
 * supporting both SaaS (multi-tenant) and Dedicated (self-contained) deployment modes
 * per Module Reference v2.2 Section 11.1
 */

import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import {
  ProjectConfig,
  EnvironmentConfig,
  LicenseConfig,
  DockerStack,
  TemplateContext,
  GeneratorOptions,
} from './types';

/**
 * Docker Stack Generator
 *
 * Main generator class for creating Docker Compose stacks using Handlebars templates
 */
export class DockerStackGenerator {
  private templateCache: Map<string, HandlebarsTemplateDelegate> = new Map();
  private templatesPath: string;
  private validate: boolean;

  /**
   * Create a new Docker Stack Generator
   *
   * @param options - Generator options
   */
  constructor(options: GeneratorOptions = {}) {
    this.templatesPath =
      options.templatesPath ||
      path.join(__dirname, 'templates');
    this.validate = options.validate ?? true;

    this.registerHandlebarsHelpers();
  }

  /**
   * Generate complete Docker stack
   *
   * @param project - Project configuration
   * @param environment - Environment configuration
   * @param license - License configuration
   * @returns Docker stack with all configuration files
   */
  public generate(
    project: ProjectConfig,
    environment: EnvironmentConfig,
    license: LicenseConfig
  ): DockerStack {
    // Validate inputs
    this.validateInputs(project, environment, license);

    // Build template context
    const context = this.buildTemplateContext(
      project,
      environment,
      license
    );

    // Generate docker-compose.yml
    const composeYml = this.renderTemplate('docker-compose.yml.hbs', context);

    // Generate docker-compose.prod.yml
    const composeProYml = this.renderTemplate(
      'docker-compose.prod.yml.hbs',
      context
    );

    // Generate .env.template
    const envTemplate = this.renderTemplate('env.template.hbs', context);

    // Generate nginx configuration
    const nginxConf = this.renderTemplate('nginx-default.conf.hbs', context);

    // Generate Dockerfiles
    const dockerfiles: Record<string, string> = {
      'frontend.Dockerfile': this.renderTemplate(
        'frontend.Dockerfile.hbs',
        context
      ),
      'iot-api-proxy.Dockerfile': this.renderTemplate(
        'iot-api-proxy.Dockerfile.hbs',
        context
      ),
    };

    // Add telegraf Dockerfile for Professional+ tiers
    if (context.isProfessional || context.isEnterprise) {
      dockerfiles['telegraf.Dockerfile'] = this.renderTemplate(
        'telegraf.Dockerfile.hbs',
        context
      );
    }

    // Generate README (optional)
    const readme = this.generateReadme(context);

    const stack: DockerStack = {
      composeYml,
      composeProYml,
      envTemplate,
      nginxConf,
      dockerfiles,
      readme,
    };

    // Validate output if enabled
    if (this.validate) {
      const { validateDockerStack } = require('./validator');
      const validation = validateDockerStack(stack);
      if (!validation.valid) {
        const errorMessages = validation.errors
          .map((e: { path: string; message: string }) => `${e.path}: ${e.message}`)
          .join('\n');
        throw new Error(
          `Docker stack validation failed:\n${errorMessages}`
        );
      }
    }

    return stack;
  }

  /**
   * Validate input configurations
   */
  private validateInputs(
    project: ProjectConfig,
    environment: EnvironmentConfig,
    license: LicenseConfig
  ): void {
    // Validate project
    if (!project.projectId) {
      throw new Error('Project ID is required');
    }
    if (!project.projectName) {
      throw new Error('Project name is required');
    }
    if (!project.version) {
      throw new Error('Project version is required');
    }
    if (!project.tier) {
      throw new Error('Project tier is required');
    }

    // Validate tier-based features
    if (project.features.ollama && project.tier !== 'enterprise') {
      throw new Error('Ollama is only available for Enterprise tier');
    }
    if (project.features.helm && project.tier !== 'enterprise') {
      throw new Error('Helm is only available for Enterprise tier');
    }
    if (project.features.airgap && project.tier !== 'enterprise') {
      throw new Error('Air-gap support is only available for Enterprise tier');
    }
    if (
      project.features.thirdPartyIngestion &&
      project.tier === 'starter'
    ) {
      throw new Error(
        'Third-party ingestion requires Professional or Enterprise tier'
      );
    }

    // Validate environment
    if (!environment.deploymentMode) {
      throw new Error('Deployment mode is required');
    }
    if (!environment.baseDomain) {
      throw new Error('Base domain is required');
    }

    // Validate APIs
    if (!environment.northboundApi?.url) {
      throw new Error('Northbound API URL is required');
    }
    if (!environment.eventsApi?.url) {
      throw new Error('Events API URL is required');
    }
    if (!environment.qoeApi?.url) {
      throw new Error('QoE API URL is required');
    }

    // Validate LLM provider
    if (!environment.llmProvider?.provider) {
      throw new Error('LLM provider is required');
    }
    if (
      environment.llmProvider.provider === 'anthropic' &&
      !environment.llmProvider.anthropicApiKey
    ) {
      throw new Error(
        'Anthropic API key is required when using Anthropic provider'
      );
    }
    if (
      environment.llmProvider.provider === 'ollama' &&
      !environment.llmProvider.ollamaUrl
    ) {
      throw new Error(
        'Ollama URL is required when using Ollama provider'
      );
    }
    if (
      environment.llmProvider.provider === 'ollama' &&
      project.tier !== 'enterprise'
    ) {
      throw new Error('Ollama provider requires Enterprise tier');
    }

    // Validate database
    if (!environment.database?.postgres) {
      throw new Error('PostgreSQL configuration is required');
    }
    if (!environment.database?.influxdb) {
      throw new Error('InfluxDB configuration is required');
    }
    if (!environment.redis) {
      throw new Error('Redis configuration is required');
    }

    // Validate license
    if (!license.licenseKey) {
      throw new Error('License key is required');
    }
    if (!license.tenantId) {
      throw new Error('Tenant ID is required');
    }
    if (!license.expiryDate) {
      throw new Error('License expiry date is required');
    }
  }

  /**
   * Build template context with computed flags
   */
  private buildTemplateContext(
    project: ProjectConfig,
    environment: EnvironmentConfig,
    license: LicenseConfig
  ): TemplateContext {
    const isSaas = environment.deploymentMode === 'saas';
    const isDedicated = environment.deploymentMode === 'dedicated';
    const isStarter = project.tier === 'starter';
    const isProfessional = project.tier === 'professional';
    const isEnterprise = project.tier === 'enterprise';

    return {
      project,
      environment,
      license,
      isSaas,
      isDedicated,
      isStarter,
      isProfessional,
      isEnterprise,
      hasHelm: project.features.helm,
      hasGit: project.features.git,
      hasOllama: project.features.ollama,
      hasAirgap: project.features.airgap,
      hasThirdPartyIngestion: project.features.thirdPartyIngestion,
      hasCustomWidgets: project.features.customWidgets,
    };
  }

  /**
   * Render a Handlebars template
   */
  private renderTemplate(
    templateName: string,
    context: TemplateContext
  ): string {
    const template = this.loadTemplate(templateName);
    return template(context);
  }

  /**
   * Load and cache a Handlebars template
   */
  private loadTemplate(templateName: string): HandlebarsTemplateDelegate {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    const templatePath = path.join(this.templatesPath, templateName);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    const templateSource = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateSource);

    this.templateCache.set(templateName, template);
    return template;
  }

  /**
   * Register Handlebars helpers
   */
  private registerHandlebarsHelpers(): void {
    // Comparison helpers
    Handlebars.registerHelper('eq', (a, b) => a === b);
    Handlebars.registerHelper('ne', (a, b) => a !== b);
    Handlebars.registerHelper('gt', (a, b) => a > b);
    Handlebars.registerHelper('lt', (a, b) => a < b);
    Handlebars.registerHelper('gte', (a, b) => a >= b);
    Handlebars.registerHelper('lte', (a, b) => a <= b);

    // Logic helpers
    Handlebars.registerHelper('and', (...args) => {
      const values = args.slice(0, -1); // Remove options object
      return values.every((v) => !!v);
    });
    Handlebars.registerHelper('or', (...args) => {
      const values = args.slice(0, -1); // Remove options object
      return values.some((v) => !!v);
    });
    Handlebars.registerHelper('not', (value) => !value);

    // Utility helpers
    Handlebars.registerHelper('json', (context) =>
      JSON.stringify(context, null, 2)
    );
    Handlebars.registerHelper('upper', (str) =>
      typeof str === 'string' ? str.toUpperCase() : str
    );
    Handlebars.registerHelper('lower', (str) =>
      typeof str === 'string' ? str.toLowerCase() : str
    );
    Handlebars.registerHelper('env', (key) => process.env[key] || '');
  }

  /**
   * Generate README.md content
   */
  private generateReadme(context: TemplateContext): string {
    const { project, environment } = context;
    const mode = environment.deploymentMode;
    const tier = project.tier;

    return `# ${project.projectName} - Docker Deployment

Version: ${project.version}
Deployment Mode: ${mode}
Tier: ${tier}
Generated: ${new Date().toISOString()}

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB RAM minimum (8GB recommended for Enterprise)
- ${context.isEnterprise ? '8GB' : context.isProfessional ? '4GB' : '2GB'} disk space

## Quick Start

1. Copy environment template:
   \`\`\`bash
   cp .env.template .env
   \`\`\`

2. Edit \`.env\` and configure:
   - License key and tenant ID
   - Friendly API credentials (Northbound, Events, QoE)
   - LLM provider settings (${environment.llmProvider.provider})
   - Database credentials

3. Start services:
   \`\`\`bash
   docker-compose up -d
   \`\`\`

4. Verify services are running:
   \`\`\`bash
   docker-compose ps
   \`\`\`

5. Access the application:
   - Frontend: ${mode === 'saas' ? `https://${project.projectId}.${environment.baseDomain}` : `http://localhost:80`}
   - Grafana: ${mode === 'saas' ? `https://grafana.${environment.baseDomain}/${project.projectId}` : `http://localhost:3001`}

## Services

### Core Services (All Tiers)
- **frontend**: Angular application
- **grafana**: Monitoring dashboards
- **influxdb**: Time-series database
- **postgres**: Relational database
- **redis**: Cache and rate limiting
- **iot-api-proxy**: Friendly API integration
- **license-agent**: License validation
- **nginx-proxy**: Reverse proxy

${context.hasThirdPartyIngestion ? '### Professional/Enterprise Services\n- **telegraf**: Third-party data ingestion\n' : ''}

## Configuration

### Deployment Mode: ${mode}

${mode === 'saas' ? '- Multi-tenant shared infrastructure\n- No port mappings (accessed via nginx-proxy)\n- Tenant-scoped middleware' : '- Single-tenant self-contained\n- All ports exposed\n- Custom subnet: 172.28.0.0/16'}

### Tier: ${tier}

${tier === 'starter' ? '- Basic features\n- 100k API calls/month\n- No grace period' : tier === 'professional' ? '- Git integration\n- Third-party ingestion\n- 2M API calls/month\n- 24h grace period' : '- Helm charts\n- Ollama LLM provider\n- Air-gap support\n- 20M API calls/month\n- 7d grace period'}

### LLM Provider: ${environment.llmProvider.provider}

${environment.llmProvider.provider === 'anthropic' ? '- Using Anthropic Claude\n- Configure ANTHROPIC_API_KEY in .env' : '- Using Ollama (self-hosted)\n- Configure OLLAMA_URL in .env\n- Enterprise tier required'}

## Maintenance

### View Logs
\`\`\`bash
docker-compose logs -f [service-name]
\`\`\`

### Restart Service
\`\`\`bash
docker-compose restart [service-name]
\`\`\`

### Stop All Services
\`\`\`bash
docker-compose down
\`\`\`

### Backup Database
\`\`\`bash
# PostgreSQL
docker-compose exec postgres pg_dump -U \${POSTGRES_USER} \${POSTGRES_DB} > backup.sql

# InfluxDB
docker-compose exec influxdb influx backup /tmp/backup
docker-compose cp influxdb:/tmp/backup ./influxdb-backup
\`\`\`

## Troubleshooting

### License Validation Errors
- Check license key format in .env
- Verify tenant ID matches license
- Check license expiry date
- Review license-agent logs: \`docker-compose logs license-agent\`

### API Connection Errors
- Verify Friendly API credentials in .env
- Check network connectivity to Friendly APIs
- Review iot-api-proxy logs: \`docker-compose logs iot-api-proxy\`

### Database Connection Errors
- Verify database credentials in .env
- Check if databases are healthy: \`docker-compose ps\`
- Review database logs: \`docker-compose logs postgres influxdb\`

## Support

For support, contact Friendly Technologies:
- Email: support@friendly-tech.com
- Documentation: https://docs.friendly-tech.com/aep

---

Generated by Friendly AI AEP Tool v${project.version}
`;
  }
}

/**
 * Factory function to create a Docker Stack Generator
 *
 * @param options - Generator options
 * @returns DockerStackGenerator instance
 */
export function createGenerator(
  options?: GeneratorOptions
): DockerStackGenerator {
  return new DockerStackGenerator(options);
}

/**
 * Generate Docker stack (convenience function)
 *
 * @param project - Project configuration
 * @param environment - Environment configuration
 * @param license - License configuration
 * @param options - Generator options
 * @returns Docker stack
 */
export function generateDockerStack(
  project: ProjectConfig,
  environment: EnvironmentConfig,
  license: LicenseConfig,
  options?: GeneratorOptions
): DockerStack {
  const generator = createGenerator(options);
  return generator.generate(project, environment, license);
}
