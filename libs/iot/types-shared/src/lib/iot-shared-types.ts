/**
 * @fileoverview Shared IoT type definitions used across swagger-ingestion,
 * sdk-generator, and auth-adapter. Extracting these here removes the circular
 * dependency between those three packages.
 *
 * swagger-ingestion ──▶ iot/types-shared
 * sdk-generator      ──▶ iot/types-shared
 * auth-adapter       ──▶ iot/types-shared  (for FriendlyAuthAdapterInterface)
 */

import type { OpenAPIV3 } from 'openapi-types';

// ============================================================================
// API Identifier
// ============================================================================

/**
 * Supported Friendly API identifiers used throughout the AEP system.
 */
export type ApiId = 'northbound' | 'events' | 'qoe';

// ============================================================================
// Auth types shared between auth-adapter and SDK consumers
// ============================================================================

/**
 * Minimal interface that SDK consumers depend on from the auth-adapter.
 * The full FriendlyAuthAdapter class satisfies this interface, but
 * consuming packages only need to reference this — not the full adapter.
 */
export interface FriendlyAuthAdapterInterface {
  /** Returns true once the adapter has been initialised. */
  isInitialized(): boolean;

  /** Returns the tenant ID this adapter is configured for. */
  getTenantId(): string;

  /** Returns HTTP auth headers for the given API. */
  getAuthHeaders(apiId: ApiId): Promise<Record<string, string>>;

  /**
   * Handles a 401 Unauthorized response by refreshing the token for the
   * given API.
   */
  handle401(apiId: ApiId): Promise<void>;
}

// ============================================================================
// OpenAPI operation and parameter types
// ============================================================================

/**
 * Parameter serialisation style (OpenAPI 3.x §4.7.12)
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
 * Normalised API operation parameter.
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
  /** Kept for backward compatibility with swagger-ingestion normaliser. */
  type: string;
}

/**
 * Normalised API operation (endpoint).
 */
export interface Operation {
  /** Unique operation identifier from the OpenAPI spec. */
  operationId: string;

  /** HTTP method. */
  method:
    | 'GET'
    | 'POST'
    | 'PUT'
    | 'DELETE'
    | 'PATCH'
    | 'HEAD'
    | 'OPTIONS'
    | 'TRACE';

  /** URL path template. */
  path: string;

  /** API identifier this operation belongs to. */
  apiId: ApiId;

  summary?: string;
  description?: string;
  tags?: string[];
  parameters: ApiParameter[];
  requestBody?: OpenAPIV3.RequestBodyObject;
  responses: Record<string, OpenAPIV3.ResponseObject>;
  security?: OpenAPIV3.SecurityRequirementObject[];
  callbacks?: Record<string, OpenAPIV3.CallbackObject>;
  deprecated?: boolean;
  externalDocs?: OpenAPIV3.ExternalDocumentationObject;
}

/**
 * Backward-compatible alias for Operation.
 * @deprecated Use `Operation` directly.
 */
export type ApiOperation = Operation;

// ============================================================================
// Normalised API specification
// ============================================================================

/**
 * Normalised representation of a single ingested OpenAPI specification.
 */
export interface ApiSpec {
  /** API identifier. */
  id: ApiId;

  /** OpenAPI version string, e.g. `"3.0.3"`. */
  openApiVersion: string;

  /** API info block. */
  info: OpenAPIV3.InfoObject;

  /** Server configurations. */
  servers: OpenAPIV3.ServerObject[];

  /** API paths and their operations. */
  paths: Record<string, OpenAPIV3.PathItemObject>;

  /** All operations extracted from paths. */
  operations: Operation[];

  /** Reusable components (schemas, responses, parameters, etc.). */
  components: OpenAPIV3.ComponentsObject;

  security?: OpenAPIV3.SecurityRequirementObject[];
  tags?: OpenAPIV3.TagObject[];
  externalDocs?: OpenAPIV3.ExternalDocumentationObject;

  /** Original raw spec (preserved for debugging; not used for generation). */
  rawSpec?: OpenAPIV3.Document;

  // Backward-compatibility aliases
  /** @deprecated Use `id` instead. */
  apiId?: string;
  /** @deprecated Use `openApiVersion` instead. */
  openapi?: string;
}

// ============================================================================
// Shared entity definitions
// ============================================================================

/**
 * Shared entity definition extracted from multiple API specifications.
 */
export interface EntityDefinition {
  name: string;
  type:
    | 'device'
    | 'alert'
    | 'telemetry'
    | 'event'
    | 'configuration'
    | 'user'
    | 'other';
  schema: OpenAPIV3.SchemaObject;
  referencedBy: Array<{
    apiId: ApiId;
    operationIds: string[];
    usage: 'request' | 'response' | 'both';
  }>;
  isShared: boolean;
  originalRefs: string[];
  description?: string;
  relationships?: Array<{
    entityName: string;
    relationship: 'parent' | 'child' | 'reference' | 'composition';
    description?: string;
  }>;
}

// ============================================================================
// Unified API model
// ============================================================================

/**
 * Unified model containing all ingested and normalised API specifications.
 */
export interface UnifiedApiModel {
  /** Normalised API specifications grouped by API type. */
  apis: Record<ApiId, ApiSpec>;

  /** Shared entity definitions referenced across multiple APIs. */
  sharedEntities: Record<string, EntityDefinition>;

  /** Flattened list of all operations across all APIs. */
  operations: Operation[];

  metadata: {
    generatedAt: string;
    version?: string;
    schemaVersion?: string;
    sourceCount?: number;
    totalApis?: number;
    totalOperations?: number;
    totalEntities?: number;
  };

  // Backward-compatibility fields
  /** @deprecated Use `apis` instead. */
  specs?: ApiSpec[];
  /** @deprecated Use `metadata.generatedAt` instead. */
  ingestedAt?: Date;
  /** @deprecated Use a hash function on the model instead. */
  modelHash?: string;
}
