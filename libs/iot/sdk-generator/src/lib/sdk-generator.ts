/**
 * SDK Generator for Friendly AI AEP
 * Generates TypeScript SDK from unified API model
 */

// @ts-nocheck - TODO: Fix type issues with swagger-ingestion integration
import * as fs from 'fs/promises';
import * as path from 'path';
import Handlebars from 'handlebars';
import type { OpenAPIV3 } from 'openapi-types';

// TODO: Fix circular dependency with swagger-ingestion - define types locally
type UnifiedApiModel = any;
type ApiId = any;
type ApiSpec = any;
type Operation = any;
import type {
  GeneratedSdk,
  TypeDefinition,
  PropertyDefinition,
  ServiceOperation,
  ParameterDefinition,
  SdkGeneratorOptions,
  TemplateContext,
} from './types';

/**
 * Template names used by the generator
 */
export enum TemplateName {
  SERVICE = 'service.ts.hbs',
  TYPES = 'types.ts.hbs',
  INDEX = 'index.ts.hbs',
}

/**
 * Error thrown during SDK generation
 */
export class SdkGenerationError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SdkGenerationError';
  }
}

/**
 * SDK Generator class
 * Converts UnifiedApiModel into TypeScript SDK code
 */
export class SdkGenerator {
  private readonly model: UnifiedApiModel;
  private readonly outputDir: string;
  private readonly options: Required<Omit<SdkGeneratorOptions, 'model' | 'outputDir'>>;
  private readonly templates: Map<TemplateName, HandlebarsTemplateDelegate>;
  private readonly templateDir: string;

  /**
   * Creates a new SDK generator instance
   * @param options - Generation options including model and output directory
   */
  constructor(options: SdkGeneratorOptions) {
    this.model = options.model;
    this.outputDir = options.outputDir;
    this.options = {
      packageName: options.packageName ?? '@friendly-tech/iot-sdk',
      packageVersion: options.packageVersion ?? '1.0.0',
      includeExamples: options.includeExamples ?? true,
      includeJsDoc: options.includeJsDoc ?? true,
      includeValidation: options.includeValidation ?? false,
      templateEngine: options.templateEngine ?? 'handlebars',
      customTemplatesPath: options.customTemplatesPath ?? undefined,
      formatCode: options.formatCode ?? true,
      prettierConfig: options.prettierConfig ?? {},
    };
    this.templates = new Map();
    this.templateDir = this.options.customTemplatesPath ?? path.join(__dirname, '..', 'templates');

    // Register Handlebars helpers
    this.registerHelpers();
  }

  /**
   * Generates all services and types
   * @returns Object with paths to generated files
   */
  async generateAll(): Promise<GeneratedSdk> {
    try {
      // Ensure output directory exists
      await fs.mkdir(this.outputDir, { recursive: true });

      const files = {
        northboundService: '',
        eventsService: '',
        qoeService: '',
        types: '',
        index: '',
        errors: '',
      };

      // Generate service for each API
      if (this.model.apis.northbound) {
        files.northboundService = await this.generateService('northbound', this.outputDir);
      }
      if (this.model.apis.events) {
        files.eventsService = await this.generateService('events', this.outputDir);
      }
      if (this.model.apis.qoe) {
        files.qoeService = await this.generateService('qoe', this.outputDir);
      }

      // Generate types
      files.types = await this.generateTypes(this.outputDir);

      // Generate index
      files.index = await this.generateIndex(this.outputDir);

      return {
        outputDir: this.outputDir,
        files,
      };
    } catch (error) {
      throw new SdkGenerationError(
        'Failed to generate SDK',
        error,
        { outputDir: this.outputDir }
      );
    }
  }

  /**
   * Generates a single service file
   * @param apiId - API identifier
   * @param outputDir - Output directory
   * @returns Path to generated file
   */
  async generateService(apiId: ApiId, outputDir: string): Promise<string> {
    try {
      const apiSpec = this.model.apis[apiId];
      if (!apiSpec) {
        throw new Error(`API spec not found for apiId: ${apiId}`);
      }

      // Build template context
      const context: TemplateContext = {
        packageName: this.options.packageName,
        packageVersion: this.options.packageVersion,
        types: [],
        operations: {
          [apiId]: this.buildServiceOperations(apiSpec.operations),
        } as Record<ApiId, ServiceOperation[]>,
        sharedEntities: [],
        generatedAt: new Date().toISOString(),
        apiMetadata: {
          [apiId]: {
            version: apiSpec.info.version,
            title: apiSpec.info.title,
            description: apiSpec.info.description,
            baseUrl: this.getBaseUrl(apiSpec),
          },
        } as Record<ApiId, any>,
      };

      // Load and compile template
      const template = await this.loadTemplate(TemplateName.SERVICE);
      const content = template(context);

      // Write file
      const fileName = `${this.generateClassName(apiId)}.ts`;
      const filePath = path.join(outputDir, fileName);
      await fs.writeFile(filePath, content, 'utf-8');

      return filePath;
    } catch (error) {
      throw new SdkGenerationError(
        `Failed to generate service for ${apiId}`,
        error,
        { apiId, outputDir }
      );
    }
  }

  /**
   * Generates types.ts with all interfaces
   * @param outputDir - Output directory
   * @returns Path to generated file
   */
  async generateTypes(outputDir: string): Promise<string> {
    try {
      const typeDefinitions: TypeDefinition[] = [];

      // Extract types from all operations
      for (const operation of this.model.operations) {
        // Extract request types
        const requestTypes = this.extractRequestTypes([operation]);
        typeDefinitions.push(...requestTypes);

        // Extract response types
        const responseTypes = this.extractResponseTypes([operation]);
        typeDefinitions.push(...responseTypes);
      }

      // Extract types from shared entities
      for (const [entityName, entity] of Object.entries(this.model.sharedEntities)) {
        const typeDef = this.schemaToTypeDefinition(
          entityName,
          entity.schema,
          entity.referencedBy.map((ref) => ref.apiId)
        );
        if (typeDef) {
          typeDef.isShared = true;
          typeDefinitions.push(typeDef);
        }
      }

      // Deduplicate types by name
      const uniqueTypes = this.deduplicateTypes(typeDefinitions);

      // Build template context
      const context: TemplateContext = {
        packageName: this.options.packageName,
        packageVersion: this.options.packageVersion,
        types: uniqueTypes,
        operations: {} as Record<ApiId, ServiceOperation[]>,
        sharedEntities: uniqueTypes.filter((t) => t.isShared),
        generatedAt: new Date().toISOString(),
        apiMetadata: {} as Record<ApiId, any>,
      };

      // Load and compile template
      const template = await this.loadTemplate(TemplateName.TYPES);
      const content = template(context);

      // Write file
      const filePath = path.join(outputDir, 'types.ts');
      await fs.writeFile(filePath, content, 'utf-8');

      return filePath;
    } catch (error) {
      throw new SdkGenerationError(
        'Failed to generate types file',
        error,
        { outputDir }
      );
    }
  }

  /**
   * Generates barrel export index.ts
   * @param outputDir - Output directory
   * @returns Path to generated file
   */
  async generateIndex(outputDir: string): Promise<string> {
    try {
      const services = Object.keys(this.model.apis).map((apiId) => ({
        apiId: apiId as ApiId,
        className: this.generateClassName(apiId as ApiId),
        fileName: this.generateClassName(apiId as ApiId),
      }));

      const context = {
        services,
        exportTypes: true,
      };

      // Load and compile template
      const template = await this.loadTemplate(TemplateName.INDEX);
      const content = template(context);

      // Write file
      const filePath = path.join(outputDir, 'index.ts');
      await fs.writeFile(filePath, content, 'utf-8');

      return filePath;
    } catch (error) {
      throw new SdkGenerationError(
        'Failed to generate index file',
        error,
        { outputDir }
      );
    }
  }

  /**
   * Loads a Handlebars template
   * @param name - Template name
   * @returns Compiled template
   */
  private async loadTemplate(name: TemplateName): Promise<HandlebarsTemplateDelegate> {
    // Check cache first
    if (this.templates.has(name)) {
      return this.templates.get(name)!;
    }

    try {
      const templatePath = path.join(this.templateDir, name);
      const templateSource = await fs.readFile(templatePath, 'utf-8');
      const template = Handlebars.compile(templateSource);
      this.templates.set(name, template);
      return template;
    } catch (error) {
      throw new SdkGenerationError(
        `Failed to load template: ${name}`,
        error,
        { templatePath: this.templateDir }
      );
    }
  }

  /**
   * Builds service operations from raw operations
   * @param operations - Operations to convert
   * @returns Array of service operations
   */
  private buildServiceOperations(operations: Operation[]): ServiceOperation[] {
    return operations.map((op) => {
      const pathParams = this.buildParameterDefinitions(op).filter((p) => p.in === 'path');
      const queryParams = this.buildParameterDefinitions(op).filter((p) => p.in === 'query');

      return {
        methodName: this.generateMethodName(op),
        path: op.path,
        method: op.method,
        summary: op.summary,
        description: op.description,
        requestType: this.getRequestBodyType(op),
        responseType: this.getResponseType(op),
        pathParams,
        queryParams,
        hasParams: pathParams.length > 0 || queryParams.length > 0,
        hasBody: !!op.requestBody,
        operationId: op.operationId,
        tags: op.tags,
        deprecated: op.deprecated,
      };
    });
  }

  /**
   * Extracts request type definitions from operations
   * @param operations - Operations to extract from
   * @returns Array of type definitions
   */
  private extractRequestTypes(operations: Operation[]): TypeDefinition[] {
    const types: TypeDefinition[] = [];

    for (const operation of operations) {
      if (!operation.requestBody) continue;

      const requestBody = operation.requestBody as OpenAPIV3.RequestBodyObject;
      const content = requestBody.content?.['application/json'];
      if (!content?.schema) continue;

      const schema = content.schema as OpenAPIV3.SchemaObject;
      const typeName = this.generateRequestTypeName(operation);
      const typeDef = this.schemaToTypeDefinition(typeName, schema, [operation.apiId]);

      if (typeDef) {
        types.push(typeDef);
      }
    }

    return types;
  }

  /**
   * Extracts response type definitions from operations
   * @param operations - Operations to extract from
   * @returns Array of type definitions
   */
  private extractResponseTypes(operations: Operation[]): TypeDefinition[] {
    const types: TypeDefinition[] = [];

    for (const operation of operations) {
      for (const [statusCode, response] of Object.entries(operation.responses)) {
        // Focus on success responses
        if (!statusCode.startsWith('2')) continue;

        const responseObj = response as OpenAPIV3.ResponseObject;
        const content = responseObj.content?.['application/json'];
        if (!content?.schema) continue;

        const schema = content.schema as OpenAPIV3.SchemaObject;
        const typeName = this.generateResponseTypeName(operation, statusCode);
        const typeDef = this.schemaToTypeDefinition(typeName, schema, [operation.apiId]);

        if (typeDef) {
          types.push(typeDef);
        }
      }
    }

    return types;
  }

  /**
   * Converts OpenAPI schema to TypeDefinition
   * @param name - Type name
   * @param schema - OpenAPI schema
   * @param usedBy - APIs that use this type
   * @returns Type definition or undefined
   */
  private schemaToTypeDefinition(
    name: string,
    schema: OpenAPIV3.SchemaObject,
    usedBy: ApiId[]
  ): TypeDefinition | undefined {
    if (!schema) return undefined;

    // Handle object/interface
    if (schema.type === 'object' || schema.properties) {
      const properties: PropertyDefinition[] = Object.entries(schema.properties || {}).map(
        ([propName, propSchema]) => {
          const prop = propSchema as OpenAPIV3.SchemaObject;
          return {
            name: propName,
            type: this.schemaToTypeString(prop),
            required: schema.required?.includes(propName) ?? false,
            description: prop.description,
            isArray: prop.type === 'array',
            nullable: prop.nullable,
            format: prop.format,
            enum: prop.enum as (string | number)[] | undefined,
            example: prop.example,
          };
        }
      );

      return {
        name,
        properties,
        description: schema.description,
        isShared: false,
        metadata: {
          usedBy,
        },
      };
    }

    // For other types, return a simple type definition
    return {
      name,
      properties: [],
      description: schema.description,
      isShared: false,
      metadata: {
        usedBy,
      },
    };
  }

  /**
   * Converts OpenAPI schema to TypeScript type string
   * @param schema - OpenAPI schema
   * @returns TypeScript type string
   */
  private schemaToTypeString(schema: OpenAPIV3.SchemaObject): string {
    if (!schema) return 'unknown';

    // Handle $ref (simplified - real implementation would resolve refs)
    if ('$ref' in schema) {
      const refName = (schema as any).$ref.split('/').pop();
      return this.toPascalCase(refName || 'unknown');
    }

    // Handle array
    if (schema.type === 'array' && schema.items) {
      const itemType = this.schemaToTypeString(schema.items as OpenAPIV3.SchemaObject);
      return `${itemType}[]`;
    }

    // Handle primitive types
    switch (schema.type) {
      case 'string':
        return 'string';
      case 'number':
      case 'integer':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'object':
        return 'Record<string, unknown>';
      case 'null':
        return 'null';
      default:
        return 'unknown';
    }
  }

  /**
   * Builds parameter definitions for a method
   * @param operation - Operation to extract parameters from
   * @returns Array of parameter definitions
   */
  private buildParameterDefinitions(operation: Operation): ParameterDefinition[] {
    return operation.parameters.map((param) => ({
      name: param.name,
      type: this.schemaToTypeString(param.schema),
      required: param.required,
      in: param.in,
      description: param.description,
      isArray: param.schema.type === 'array',
      format: param.schema.format,
      enum: param.schema.enum as (string | number)[] | undefined,
      example: param.example,
    }));
  }

  /**
   * Gets request body type name for an operation
   * @param operation - Operation
   * @returns Type name or undefined
   */
  private getRequestBodyType(operation: Operation): string | undefined {
    if (!operation.requestBody) return undefined;
    return this.generateRequestTypeName(operation);
  }

  /**
   * Gets response type name for an operation
   * @param operation - Operation
   * @returns Type name or undefined
   */
  private getResponseType(operation: Operation): string | undefined {
    // Get first 2xx response
    for (const statusCode of Object.keys(operation.responses)) {
      if (statusCode.startsWith('2')) {
        return this.generateResponseTypeName(operation, statusCode);
      }
    }
    return 'void';
  }

  /**
   * Generates method name from operation
   * @param operation - Operation
   * @returns Method name in camelCase
   */
  private generateMethodName(operation: Operation): string {
    // If operationId exists and is valid, use it
    if (operation.operationId && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(operation.operationId)) {
      return this.toCamelCase(operation.operationId);
    }

    // Generate from method and path
    const method = operation.method.toLowerCase();
    const pathParts = operation.path
      .split('/')
      .filter((part) => part && !part.startsWith('{'))
      .map((part) => this.toPascalCase(part));

    return this.toCamelCase(`${method}_${pathParts.join('_')}`);
  }

  /**
   * Generates parameter list string for method signature
   * @param operation - Operation
   * @returns Parameter list string
   */
  private generateParameterList(operation: Operation): string {
    const params = operation.parameters.map((param) => {
      const optional = param.required ? '' : '?';
      return `${param.name}${optional}: ${this.schemaToTypeString(param.schema)}`;
    });

    if (operation.requestBody) {
      params.push(`body: ${this.generateRequestTypeName(operation)}`);
    }

    return params.join(', ');
  }

  /**
   * Generates request type name
   * @param operation - Operation
   * @returns Type name
   */
  private generateRequestTypeName(operation: Operation): string {
    const methodName = this.generateMethodName(operation);
    return `${this.toPascalCase(methodName)}Request`;
  }

  /**
   * Generates response type name
   * @param operation - Operation
   * @param _statusCode - HTTP status code (unused but kept for API compatibility)
   * @returns Type name
   */
  private generateResponseTypeName(operation: Operation, _statusCode: string): string {
    const methodName = this.generateMethodName(operation);
    return `${this.toPascalCase(methodName)}Response`;
  }

  /**
   * Generates class name from API ID
   * @param apiId - API identifier
   * @returns Class name in PascalCase
   */
  private generateClassName(apiId: ApiId): string {
    return `${this.toPascalCase(apiId)}Service`;
  }

  /**
   * Gets base URL from API spec
   * @param apiSpec - API specification
   * @returns Base URL
   */
  private getBaseUrl(apiSpec: ApiSpec): string {
    if (apiSpec.servers && apiSpec.servers.length > 0) {
      return apiSpec.servers[0].url;
    }
    return 'https://api.example.com';
  }

  /**
   * Deduplicates type definitions by name
   * @param types - Type definitions
   * @returns Deduplicated types
   */
  private deduplicateTypes(types: TypeDefinition[]): TypeDefinition[] {
    const seen = new Map<string, TypeDefinition>();
    for (const type of types) {
      if (!seen.has(type.name)) {
        seen.set(type.name, type);
      }
    }
    return Array.from(seen.values());
  }

  /**
   * Converts string to camelCase
   * @param str - Input string
   * @returns camelCase string
   */
  private toCamelCase(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
      .replace(/^[A-Z]/, (char) => char.toLowerCase());
  }

  /**
   * Converts string to PascalCase
   * @param str - Input string
   * @returns PascalCase string
   */
  private toPascalCase(str: string): string {
    const camel = this.toCamelCase(str);
    return camel.charAt(0).toUpperCase() + camel.slice(1);
  }

  /**
   * Registers Handlebars helpers
   */
  private registerHelpers(): void {
    // camelCase helper
    Handlebars.registerHelper('camelCase', (str: string) => {
      return this.toCamelCase(str);
    });

    // pascalCase helper
    Handlebars.registerHelper('pascalCase', (str: string) => {
      return this.toPascalCase(str);
    });

    // httpMethod helper (lowercase)
    Handlebars.registerHelper('httpMethod', (method: string) => {
      return method.toLowerCase();
    });

    // pathParams helper - extracts path parameters
    Handlebars.registerHelper('pathParams', (parameters: ParameterDefinition[]) => {
      return parameters.filter((p) => p.in === 'path');
    });

    // queryParams helper - extracts query parameters
    Handlebars.registerHelper('queryParams', (parameters: ParameterDefinition[]) => {
      return parameters.filter((p) => p.in === 'query');
    });
  }
}

/**
 * Creates a new SDK generator instance
 * @param options - Generator options
 * @returns SDK generator instance
 */
export function createSdkGenerator(options: SdkGeneratorOptions): SdkGenerator {
  return new SdkGenerator(options);
}
