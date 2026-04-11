/**
 * TypeScript type definitions for SDK generation
 * Defines interfaces for generated SDK structure, service operations, and type definitions
 */

// TODO: Fix circular dependency with swagger-ingestion - define types locally
export type UnifiedApiModel = any;
export type ApiId = any;
export type Operation = any;

/**
 * Result of SDK generation process
 * Contains paths to all generated files
 */
export interface GeneratedSdk {
  /**
   * Root directory where SDK files were generated
   */
  outputDir: string;

  /**
   * Paths to individual generated files
   */
  files: {
    /**
     * Path to the generated northbound API service file
     */
    northboundService: string;

    /**
     * Path to the generated events API service file
     */
    eventsService: string;

    /**
     * Path to the generated QoE API service file
     */
    qoeService: string;

    /**
     * Path to the generated TypeScript type definitions file
     */
    types: string;

    /**
     * Path to the generated index/barrel file
     */
    index: string;

    /**
     * Path to the generated errors file
     */
    errors: string;
  };
}

/**
 * TypeScript type definition extracted from OpenAPI schema
 * Represents a data structure (interface, type, class) in the generated SDK
 */
export interface TypeDefinition {
  /**
   * Name of the type (will be used as interface/type name in generated code)
   * @example 'Device', 'Alert', 'TelemetryData'
   */
  name: string;

  /**
   * Properties/fields of the type
   */
  properties: PropertyDefinition[];

  /**
   * Optional description of the type
   */
  description?: string;

  /**
   * Whether this type is used across multiple APIs
   */
  isShared?: boolean;

  /**
   * Additional metadata about the type
   */
  metadata?: {
    /**
     * Original $ref path from the OpenAPI spec
     */
    originalRef?: string;

    /**
     * Which APIs use this type
     */
    usedBy?: ApiId[];

    /**
     * Whether this type has been deprecated
     */
    deprecated?: boolean;
  };
}

/**
 * Definition of a single property within a type
 */
export interface PropertyDefinition {
  /**
   * Property name
   * @example 'deviceId', 'timestamp', 'status'
   */
  name: string;

  /**
   * TypeScript type for this property
   * @example 'string', 'number', 'boolean', 'Date', 'DeviceStatus'
   */
  type: string;

  /**
   * Whether this property is required
   */
  required: boolean;

  /**
   * Optional description of the property
   */
  description?: string;

  /**
   * Whether this property is an array of the specified type
   */
  isArray?: boolean;

  /**
   * Whether this property can be null
   */
  nullable?: boolean;

  /**
   * Default value for the property (if specified in schema)
   */
  defaultValue?: any;

  /**
   * Format hint for the property (e.g., 'date-time', 'email', 'uri')
   */
  format?: string;

  /**
   * Enum values if this property is an enum
   */
  enum?: (string | number)[];

  /**
   * Example value for this property
   */
  example?: any;
}

/**
 * Represents a single API operation/endpoint in the generated SDK
 * Maps to a method in the generated service class
 */
export interface ServiceOperation {
  /**
   * Name of the method in the generated service class
   * @example 'getDevice', 'listAlerts', 'createConfiguration'
   */
  methodName: string;

  /**
   * API endpoint path
   * @example '/api/v1/devices/{deviceId}'
   */
  path: string;

  /**
   * HTTP method
   * @example 'GET', 'POST', 'PUT', 'DELETE'
   */
  method: string;

  /**
   * Brief summary of what the operation does
   */
  summary?: string;

  /**
   * Detailed description of the operation
   */
  description?: string;

  /**
   * TypeScript type name for the request body (if applicable)
   */
  requestType?: string;

  /**
   * TypeScript type name for the response body
   */
  responseType?: string;

  /**
   * Path parameters for this operation
   */
  pathParams: ParameterDefinition[];

  /**
   * Query parameters for this operation
   */
  queryParams: ParameterDefinition[];

  /**
   * Whether this operation has any parameters (path or query)
   */
  hasParams: boolean;

  /**
   * Whether this operation accepts a request body
   */
  hasBody: boolean;

  /**
   * Original operation ID from the OpenAPI spec
   */
  operationId?: string;

  /**
   * Tags associated with this operation
   */
  tags?: string[];

  /**
   * Whether this operation is deprecated
   */
  deprecated?: boolean;

  /**
   * Security requirements for this operation
   */
  security?: Array<{
    type: string;
    name: string;
    scopes?: string[];
  }>;
}

/**
 * Definition of a parameter (path, query, header, etc.)
 */
export interface ParameterDefinition {
  /**
   * Parameter name
   * @example 'deviceId', 'limit', 'offset'
   */
  name: string;

  /**
   * TypeScript type for this parameter
   * @example 'string', 'number', 'boolean'
   */
  type: string;

  /**
   * Whether this parameter is required
   */
  required: boolean;

  /**
   * Whether this parameter is an array
   */
  isArray?: boolean;

  /**
   * Description of the parameter
   */
  description?: string;

  /**
   * Default value for the parameter
   */
  defaultValue?: any;

  /**
   * Example value for this parameter
   */
  example?: any;

  /**
   * Format hint (e.g., 'date-time', 'uuid')
   */
  format?: string;

  /**
   * Enum values if this parameter is an enum
   */
  enum?: (string | number)[];

  /**
   * Parameter location
   */
  in?: 'path' | 'query' | 'header' | 'cookie';
}

/**
 * Options for configuring SDK generation
 */
export interface SdkGeneratorOptions {
  /**
   * Unified API model containing all API specifications
   */
  model: UnifiedApiModel;

  /**
   * Directory where SDK files should be generated
   */
  outputDir: string;

  /**
   * Optional package name for the generated SDK
   * @default '@friendly-tech/iot-sdk'
   */
  packageName?: string;

  /**
   * Optional package version
   * @default '1.0.0'
   */
  packageVersion?: string;

  /**
   * Whether to include example usage in generated code
   * @default true
   */
  includeExamples?: boolean;

  /**
   * Whether to generate JSDoc comments
   * @default true
   */
  includeJsDoc?: boolean;

  /**
   * Whether to generate validation code for request parameters
   * @default false
   */
  includeValidation?: boolean;

  /**
   * Template engine to use for code generation
   * @default 'handlebars'
   */
  templateEngine?: 'handlebars' | 'ejs' | 'custom';

  /**
   * Path to custom templates (if using custom template engine)
   */
  customTemplatesPath?: string;

  /**
   * Whether to format generated code with Prettier
   * @default true
   */
  formatCode?: boolean;

  /**
   * Prettier configuration for formatting
   */
  prettierConfig?: Record<string, any>;
}

/**
 * Context passed to code generation templates
 */
export interface TemplateContext {
  /**
   * Package name for the generated SDK
   */
  packageName: string;

  /**
   * Package version
   */
  packageVersion: string;

  /**
   * Type definitions to generate
   */
  types: TypeDefinition[];

  /**
   * Service operations grouped by API
   */
  operations: Record<ApiId, ServiceOperation[]>;

  /**
   * Shared entities across APIs
   */
  sharedEntities: TypeDefinition[];

  /**
   * Generation timestamp
   */
  generatedAt: string;

  /**
   * API metadata
   */
  apiMetadata: Record<ApiId, {
    version: string;
    title: string;
    description?: string;
    baseUrl?: string;
  }>;
}

/**
 * Result of code generation for a single file
 */
export interface GeneratedFile {
  /**
   * File path (relative to output directory)
   */
  path: string;

  /**
   * Generated file content
   */
  content: string;

  /**
   * File type/category
   */
  type: 'service' | 'types' | 'index' | 'errors' | 'utils' | 'config';

  /**
   * Whether this file was newly created or updated
   */
  status: 'created' | 'updated' | 'unchanged';
}

/**
 * Statistics about the SDK generation process
 */
export interface GenerationStatistics {
  /**
   * Total number of files generated
   */
  totalFiles: number;

  /**
   * Total number of type definitions generated
   */
  totalTypes: number;

  /**
   * Total number of service methods generated
   */
  totalOperations: number;

  /**
   * Operations grouped by API
   */
  operationsByApi: Record<ApiId, number>;

  /**
   * Generation duration in milliseconds
   */
  durationMs: number;

  /**
   * Timestamp when generation completed
   */
  completedAt: string;
}

/**
 * Complete result of SDK generation including all files and statistics
 */
export interface SdkGenerationResult {
  /**
   * Whether generation was successful
   */
  success: boolean;

  /**
   * Generated SDK information
   */
  sdk?: GeneratedSdk;

  /**
   * All generated files
   */
  files?: GeneratedFile[];

  /**
   * Generation statistics
   */
  statistics?: GenerationStatistics;

  /**
   * Errors encountered during generation
   */
  errors?: Array<{
    message: string;
    code: string;
    file?: string;
    severity: 'error' | 'warning';
  }>;

  /**
   * Warnings encountered during generation
   */
  warnings?: Array<{
    message: string;
    code: string;
    file?: string;
  }>;
}
