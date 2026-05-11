/**
 * TypeScript type definitions for Swagger/OpenAPI ingestion and normalization
 * Based on OpenAPI 3.x specification terminology
 */

import type { OpenAPIV3 } from 'openapi-types';

/**
 * Supported API identifiers in the AEP system
 */
export type ApiId = 'northbound' | 'events' | 'qoe';

/**
 * Source type for API specification
 */
export type SpecSourceType = 'url' | 'file';

/**
 * Authentication configuration for API specification sources
 */
export interface AuthConfig {
  type: 'basic' | 'bearer' | 'apiKey' | 'oauth2' | 'none';
  credentials?: {
    username?: string;
    password?: string;
    token?: string;
    apiKey?: string;
    apiKeyHeader?: string;
    oauth2?: OAuth2Config;
  };
}

/**
 * OAuth2 authentication configuration
 */
export interface OAuth2Config {
  flow: 'authorizationCode' | 'implicit' | 'password' | 'clientCredentials';
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes?: Record<string, string>;
  clientId?: string;
  clientSecret?: string;
}

/**
 * Configuration for ingesting a single API specification
 */
export interface SpecConfig {
  /**
   * Unique identifier for the API
   */
  apiId: ApiId;

  /**
   * Source location and type for the specification
   */
  source: {
    type: SpecSourceType;
    location: string;
  };

  /**
   * Optional authentication for accessing the specification
   */
  auth?: AuthConfig;

  /**
   * Optional metadata about the specification
   */
  metadata?: {
    version?: string;
    lastUpdated?: string;
    description?: string;
  };
}

/**
 * Parameter serialization style
 */
export type ParameterStyle =
  | 'matrix'
  | 'label'
  | 'form'
  | 'simple'
  | 'spaceDelimited'
  | 'pipeDelimited'
  | 'deepObject';

/**
 * Normalized API operation parameter
 */
export interface ApiParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  schema: OpenAPIV3.SchemaObject;
  example?: unknown;
  examples?: Record<string, OpenAPIV3.ExampleObject>;
  style?: ParameterStyle;
  explode?: boolean;
  type: string; // Kept for backward compatibility
}

/**
 * API operation (endpoint)
 */
export interface Operation {
  /**
   * Unique operation identifier
   */
  operationId: string;

  /**
   * HTTP method
   */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'TRACE';

  /**
   * URL path
   */
  path: string;

  /**
   * API identifier this operation belongs to
   */
  apiId: ApiId;

  /**
   * Operation summary
   */
  summary?: string;

  /**
   * Detailed description
   */
  description?: string;

  /**
   * Tags for grouping/categorization
   */
  tags?: string[];

  /**
   * Operation parameters
   */
  parameters: ApiParameter[];

  /**
   * Request body definition
   */
  requestBody?: OpenAPIV3.RequestBodyObject;

  /**
   * Response definitions
   */
  responses: Record<string, OpenAPIV3.ResponseObject>;

  /**
   * Security requirements for this operation
   */
  security?: OpenAPIV3.SecurityRequirementObject[];

  /**
   * Callbacks for async operations
   */
  callbacks?: Record<string, OpenAPIV3.CallbackObject>;

  /**
   * Whether the operation is deprecated
   */
  deprecated?: boolean;

  /**
   * External documentation
   */
  externalDocs?: OpenAPIV3.ExternalDocumentationObject;
}

/**
 * Backward compatible alias for Operation
 */
export type ApiOperation = Operation;

/**
 * Normalized API specification
 */
export interface ApiSpec {
  /**
   * API identifier
   */
  id: ApiId;

  /**
   * OpenAPI version
   */
  openApiVersion: string;

  /**
   * API information
   */
  info: OpenAPIV3.InfoObject;

  /**
   * Server configurations
   */
  servers: OpenAPIV3.ServerObject[];

  /**
   * API paths and their operations
   */
  paths: Record<string, OpenAPIV3.PathItemObject>;

  /**
   * All operations extracted from paths
   */
  operations: Operation[];

  /**
   * Reusable components (schemas, responses, parameters, etc.)
   */
  components: OpenAPIV3.ComponentsObject;

  /**
   * Security requirements for the API
   */
  security?: OpenAPIV3.SecurityRequirementObject[];

  /**
   * API tags for grouping operations
   */
  tags?: OpenAPIV3.TagObject[];

  /**
   * External documentation
   */
  externalDocs?: OpenAPIV3.ExternalDocumentationObject;

  /**
   * Original spec for reference (backward compatibility)
   * @deprecated Use the normalized fields instead
   */
  rawSpec?: OpenAPIV3.Document;

  // Backward compatibility aliases
  /** @deprecated Use 'id' instead */
  apiId?: string;
  /** @deprecated Use 'openApiVersion' instead */
  openapi?: string;
}

/**
 * Shared entity definition (Device, Alert, Telemetry, etc.)
 */
export interface EntityDefinition {
  /**
   * Entity name
   */
  name: string;

  /**
   * Entity type category
   */
  type: 'device' | 'alert' | 'telemetry' | 'event' | 'configuration' | 'user' | 'other';

  /**
   * Schema definition for the entity
   */
  schema: OpenAPIV3.SchemaObject;

  /**
   * APIs that reference this entity
   */
  referencedBy: Array<{
    apiId: ApiId;
    operationIds: string[];
    usage: 'request' | 'response' | 'both';
  }>;

  /**
   * Whether this entity is shared across multiple APIs
   */
  isShared: boolean;

  /**
   * Original $ref paths from source specifications
   */
  originalRefs: string[];

  /**
   * Entity description
   */
  description?: string;

  /**
   * Related entities
   */
  relationships?: Array<{
    entityName: string;
    relationship: 'parent' | 'child' | 'reference' | 'composition';
    description?: string;
  }>;
}

/**
 * Result of ingesting a single spec
 */
export interface IngestResult {
  apiId: string;
  spec: ApiSpec;
  hash: string;
}

/**
 * Ingestion result for a single specification (enhanced)
 */
export interface IngestionResult {
  /**
   * API identifier
   */
  apiId: ApiId;

  /**
   * Whether ingestion was successful
   */
  success: boolean;

  /**
   * Normalized API specification (if successful)
   */
  apiSpec?: ApiSpec;

  /**
   * Extracted entities (if successful)
   */
  entities?: EntityDefinition[];

  /**
   * Hash of the ingested specification
   */
  hash?: string;

  /**
   * Errors encountered during ingestion
   */
  errors?: Array<{
    message: string;
    code: string;
    path?: string;
    severity: 'error' | 'warning';
  }>;

  /**
   * Warnings encountered during ingestion
   */
  warnings?: Array<{
    message: string;
    code: string;
    path?: string;
  }>;

  /**
   * Statistics about the ingested specification
   */
  statistics?: {
    totalOperations: number;
    totalSchemas: number;
    totalPaths: number;
    totalParameters: number;
    totalResponses: number;
  };

  /**
   * Duration of ingestion in milliseconds
   */
  durationMs: number;

  /**
   * Timestamp of ingestion
   */
  ingestedAt: string;
}

/**
 * Shared entity across multiple APIs (backward compatible)
 * @deprecated Use EntityDefinition instead
 */
export interface SharedEntity {
  name: string;
  /** Which APIs provide this entity */
  sources: string[];
  /** Merged schema from all sources */
  schema: OpenAPIV3.SchemaObject;
  /** Conflicts found during merge */
  conflicts?: string[];
}

/**
 * Unified model containing all ingested and normalized API specifications
 */
export interface UnifiedApiModel {
  /**
   * Normalized API specifications grouped by API type
   */
  apis: Record<ApiId, ApiSpec>;

  /**
   * Shared entity definitions referenced across multiple APIs
   */
  sharedEntities: Record<string, EntityDefinition>;

  /**
   * Flattened list of all operations across all APIs
   */
  operations: Operation[];

  /**
   * Metadata about the unified model
   */
  metadata: {
    generatedAt: string;
    version?: string;
    schemaVersion?: string;
    sourceCount?: number;
    totalApis?: number;
    totalOperations?: number;
    totalEntities?: number;
  };

  // Backward compatibility fields
  /** @deprecated Use 'apis' instead */
  specs?: ApiSpec[];
  /** @deprecated Use 'metadata.generatedAt' instead */
  ingestedAt?: Date;
  /** @deprecated Use a hash function on the model instead */
  modelHash?: string;
}

/**
 * Type of breaking change
 */
export enum BreakingChangeType {
  REMOVED_ENDPOINT = 'REMOVED_ENDPOINT',
  REMOVED_PARAMETER = 'REMOVED_PARAMETER',
  PARAMETER_TYPE_CHANGED = 'PARAMETER_TYPE_CHANGED',
  PARAMETER_REQUIRED_ADDED = 'PARAMETER_REQUIRED_ADDED',
  RESPONSE_SCHEMA_CHANGED = 'RESPONSE_SCHEMA_CHANGED',
  REMOVED_REQUIRED_FIELD = 'REMOVED_REQUIRED_FIELD',
}

/**
 * Breaking change detected during API diff
 */
export interface BreakingChange {
  /**
   * Type of breaking change
   */
  type:
    | 'endpoint_removed'
    | 'endpoint_method_changed'
    | 'parameter_removed'
    | 'parameter_required_added'
    | 'parameter_type_changed'
    | 'response_removed'
    | 'response_type_changed'
    | 'property_removed'
    | 'property_required_added'
    | 'property_type_changed'
    | 'enum_value_removed'
    | 'authentication_changed'
    | 'other'
    | BreakingChangeType; // Backward compatibility with enum

  /**
   * Severity level
   */
  severity: 'critical' | 'major' | 'minor';

  /**
   * API identifier where the change occurred
   */
  apiId: ApiId;

  /**
   * Path to the changed element
   */
  path: string;

  /**
   * Operation ID if applicable
   */
  operationId?: string;

  /**
   * HTTP method if applicable (backward compatibility)
   */
  method?: string;

  /**
   * Previous value/state
   */
  before?: unknown;

  /**
   * New value/state
   */
  after?: unknown;

  /**
   * Human-readable description of the change
   */
  description: string;

  /**
   * Recommended migration steps
   */
  migration?: string;

  /**
   * Related changes that might be relevant
   */
  relatedChanges?: string[];

  /**
   * List of clients affected by this breaking change
   */
  affectedClients?: string[];

  // Backward compatibility fields
  /** @deprecated Use 'before' instead */
  oldValue?: unknown;
  /** @deprecated Use 'after' instead */
  newValue?: unknown;
}

/**
 * Non-breaking change detected during API diff
 */
export interface NonBreakingChange {
  /**
   * Type of non-breaking change
   */
  type:
    | 'endpoint_added'
    | 'parameter_added'
    | 'response_added'
    | 'property_added'
    | 'enum_value_added'
    | 'description_changed'
    | 'example_added'
    | 'deprecated_added'
    | 'other';

  /**
   * API identifier where the change occurred
   */
  apiId: ApiId;

  /**
   * Path to the changed element
   */
  path: string;

  /**
   * Operation ID if applicable
   */
  operationId?: string;

  /**
   * Previous value/state (undefined if newly added)
   */
  before?: unknown;

  /**
   * New value/state
   */
  after: unknown;

  /**
   * Human-readable description of the change
   */
  description: string;
}

/**
 * Complete diff result between two API versions
 */
export interface ApiDiff {
  /**
   * API identifier
   */
  apiId: ApiId;

  /**
   * Version information
   */
  versions: {
    before: string;
    after: string;
  };

  /**
   * Breaking changes detected
   */
  breakingChanges: BreakingChange[];

  /**
   * Non-breaking changes detected
   */
  nonBreakingChanges: NonBreakingChange[];

  /**
   * Summary statistics
   */
  summary: {
    totalChanges: number;
    breakingCount: number;
    nonBreakingCount: number;
    criticalCount: number;
    majorCount: number;
    minorCount: number;
  };

  /**
   * Timestamp of the diff analysis
   */
  analyzedAt: string;

  /**
   * Whether the diff indicates a major version bump is needed
   */
  requiresMajorVersion: boolean;

  /**
   * Whether the diff indicates a minor version bump is needed
   */
  requiresMinorVersion: boolean;
}

/**
 * Validation result for an OpenAPI specification
 */
export interface ValidationResult {
  /**
   * Whether the specification is valid
   */
  valid: boolean;

  /**
   * Validation errors
   */
  errors: Array<{
    message: string;
    path: string;
    code: string;
    severity: 'error' | 'warning';
  }>;

  /**
   * OpenAPI version detected
   */
  openApiVersion?: string;

  /**
   * Specification metadata
   */
  metadata?: {
    title?: string;
    version?: string;
    operationCount?: number;
    schemaCount?: number;
  };
}

/**
 * Events emitted by SwaggerIngestionService
 */
export interface SwaggerIngestionEvents {
  'spec-changed': (result: IngestResult) => void;
  'ingestion-error': (error: Error, apiId: string) => void;
  'breaking-changes-detected': (changes: BreakingChange[]) => void;
}

/**
 * Options for ingesting multiple specifications
 */
export interface IngestionOptions {
  /**
   * Whether to validate specifications before ingestion
   */
  validate?: boolean;

  /**
   * Whether to detect breaking changes
   */
  detectBreakingChanges?: boolean;

  /**
   * Whether to merge shared entities across APIs
   */
  mergeSharedEntities?: boolean;

  /**
   * Whether to normalize operation IDs
   */
  normalizeOperationIds?: boolean;

  /**
   * Timeout for fetching remote specifications (milliseconds)
   */
  fetchTimeout?: number;

  /**
   * Whether to fail on validation errors
   */
  strictValidation?: boolean;
}

/**
 * Entity type for categorization
 */
export type EntityType = 'device' | 'alert' | 'telemetry' | 'event' | 'configuration' | 'user' | 'other';

/**
 * Entity usage in operations
 */
export type EntityUsage = 'request' | 'response' | 'both';

/**
 * Entity relationship type
 */
export type EntityRelationship = 'parent' | 'child' | 'reference' | 'composition';

/**
 * Severity level for changes and issues
 */
export type Severity = 'critical' | 'major' | 'minor' | 'info';
