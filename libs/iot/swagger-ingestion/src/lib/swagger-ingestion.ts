/**
 * SwaggerIngestionService - Handles ingestion, validation, and diff of OpenAPI specs
 */

import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPIV3 } from 'openapi-types';
import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { parse as parseYaml } from 'yaml';
import {
  BreakingChangeType,
  type ApiId,
  type SpecConfig,
  type AuthConfig,
  type ApiSpec,
  type ApiOperation,
  type ApiParameter,
  type IngestResult,
  type UnifiedApiModel,
  type EntityDefinition,
  type BreakingChange,
  type SwaggerIngestionEvents,
} from './types';

/**
 * Minimal interface the SwaggerIngestionService requires from a credential adapter.
 *
 * When fetching specs from authenticated URLs, the service calls `getAuthHeaders`
 * with a per-request auth config object.  This is a different call signature from
 * the full FriendlyAuthAdapter (which takes an ApiId string) and is intentional:
 * swagger-ingestion needs to fetch arbitrary URLs with per-request credentials,
 * not persistent tenant API tokens.
 *
 * Defining this interface locally avoids any circular dependency with
 * `@friendly-tech/iot/auth-adapter`.
 */
interface SwaggerAuthAdapter {
  getAuthHeaders(config: {
    id: string;
    baseUrl: string;
    authMethods: string[];
    primaryAuth: string;
    credentials?: {
      username?: string;
      password?: string;
      apiKey?: string;
    };
  }): Promise<Record<string, string>>;
}

/**
 * Local alias used throughout the file.
 */
type FriendlyAuthAdapter = SwaggerAuthAdapter;

/**
 * Service for ingesting and managing OpenAPI/Swagger specifications
 */
export class SwaggerIngestionService extends EventEmitter {
  private authAdapter?: FriendlyAuthAdapter;

  constructor(authAdapter?: FriendlyAuthAdapter) {
    super();
    this.authAdapter = authAdapter;
  }

  /**
   * Ingest a single API specification
   * @param config - Spec configuration
   * @returns Ingestion result with normalized spec and hash
   */
  async ingestSpec(config: SpecConfig): Promise<IngestResult> {
    try {
      const { apiId, source, auth } = config;

      // Load spec from source
      let rawSpecData: string | object;
      if (source.type === 'url') {
        rawSpecData = await this.loadSpecFromUrl(source.location, auth);
      } else {
        rawSpecData = await this.loadSpecFromFile(source.location);
      }

      // Parse and validate spec with SwaggerParser
      const validatedSpec = (await SwaggerParser.validate(rawSpecData as any)) as OpenAPIV3.Document;

      // Normalize into ApiSpec format
      const spec = this.normalizeSpec(apiId, validatedSpec);

      // Calculate hash of the spec
      const hash = this.calculateHash(validatedSpec);

      const result: IngestResult = {
        apiId,
        spec,
        hash,
      };

      // Emit spec-changed event
      this.emit('spec-changed', result);

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('ingestion-error', err, config.apiId);
      throw new Error(`Failed to ingest spec for ${config.apiId}: ${err.message}`);
    }
  }

  /**
   * Ingest all API specifications in parallel
   * @param configs - Array of spec configurations
   * @returns Unified API model
   */
  async ingestAll(configs: SpecConfig[]): Promise<UnifiedApiModel> {
    try {
      // Ingest all specs in parallel
      const results = await Promise.all(configs.map((config) => this.ingestSpec(config)));

      // Build apis map
      const apis: Record<ApiId, ApiSpec> = {} as Record<ApiId, ApiSpec>;
      results.forEach((result) => {
        apis[result.spec.id] = result.spec;
      });

      // Normalize shared entities
      const sharedEntities = this.normalizeSharedEntities(results.map((r) => r.spec));

      // Collect all operations
      const operations = results.flatMap((r) => r.spec.operations);

      // Build unified model
      const model: UnifiedApiModel = {
        apis,
        sharedEntities,
        operations,
        metadata: {
          generatedAt: new Date().toISOString(),
          schemaVersion: '1.0.0',
          totalApis: results.length,
          totalOperations: operations.length,
          totalEntities: Object.keys(sharedEntities).length,
        },
      };

      return model;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new Error(`Failed to ingest all specs: ${err.message}`);
    }
  }

  /**
   * Compare two unified models and detect breaking changes
   * @param oldModel - Previous model
   * @param newModel - New model
   * @returns Array of breaking changes
   */
  diffSpecs(
    oldModel: UnifiedApiModel,
    newModel: UnifiedApiModel
  ): BreakingChange[] {
    const changes: BreakingChange[] = [];

    // Check each API
    for (const apiId of Object.keys(oldModel.apis) as ApiId[]) {
      const oldSpec = oldModel.apis[apiId];
      const newSpec = newModel.apis[apiId];

      if (!newSpec) {
        // Entire API removed
        oldSpec.operations.forEach((op) => {
          changes.push({
            type: BreakingChangeType.REMOVED_ENDPOINT,
            severity: 'critical',
            apiId,
            operationId: op.operationId,
            path: op.path,
            method: op.method as any,
            description: `Endpoint ${op.method} ${op.path} was removed`,
            affectedClients: [],
          });
        });
        continue;
      }

      // Compare operations
      const oldOpsMap = new Map(
        oldSpec.operations.map((op) => [`${op.method}:${op.path}`, op])
      );
      const newOpsMap = new Map(
        newSpec.operations.map((op) => [`${op.method}:${op.path}`, op])
      );

      // Check for removed endpoints
      for (const [key, oldOp] of oldOpsMap) {
        if (!newOpsMap.has(key)) {
          changes.push({
            type: BreakingChangeType.REMOVED_ENDPOINT,
            severity: 'critical',
            apiId,
            operationId: oldOp.operationId,
            path: oldOp.path,
            method: oldOp.method as any,
            description: `Endpoint ${oldOp.method} ${oldOp.path} was removed`,
            affectedClients: [],
          });
          continue;
        }

        const newOp = newOpsMap.get(key)!;

        // Check parameters
        const paramChanges = this.diffParameters(apiId, oldOp, newOp);
        changes.push(...paramChanges);

        // Check response schema changes
        const responseChanges = this.diffResponses(apiId, oldOp, newOp);
        changes.push(...responseChanges);
      }
    }

    if (changes.length > 0) {
      this.emit('breaking-changes-detected', changes);
    }

    return changes;
  }

  /**
   * Load spec from URL with optional authentication
   */
  private async loadSpecFromUrl(
    url: string,
    auth?: AuthConfig
  ): Promise<object> {
    const headers: Record<string, string> = {
      Accept: 'application/json, application/yaml, text/yaml',
    };

    // Add authentication headers if provided
    if (auth && this.authAdapter) {
      const creds = auth.credentials || {};
      const authHeaders = await this.authAdapter.getAuthHeaders({
        id: 'temp',
        baseUrl: url,
        authMethods: ['basic', 'apikey'],
        primaryAuth: creds.apiKey ? 'apikey' : 'basic',
        credentials: {
          username: creds.username,
          password: creds.password,
          apiKey: creds.apiKey,
        },
      });

      Object.assign(headers, authHeaders);
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Failed to fetch spec from ${url}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    // Parse YAML or JSON
    if (contentType.includes('yaml') || contentType.includes('yml')) {
      return parseYaml(text);
    }

    return JSON.parse(text);
  }

  /**
   * Load spec from local file
   */
  private async loadSpecFromFile(path: string): Promise<object> {
    const content = await readFile(path, 'utf-8');

    // Determine format by extension
    if (path.endsWith('.yaml') || path.endsWith('.yml')) {
      return parseYaml(content);
    }

    return JSON.parse(content);
  }

  /**
   * Calculate SHA-256 hash of spec
   */
  private calculateHash(spec: unknown): string {
    const json = JSON.stringify(spec, null, 0);
    return createHash('sha256').update(json).digest('hex');
  }

  /**
   * Normalize OpenAPI spec to ApiSpec format
   */
  private normalizeSpec(apiId: ApiId, spec: OpenAPIV3.Document): ApiSpec {
    const operations: ApiOperation[] = [];

    // Extract operations from paths
    if (spec.paths) {
      for (const [path, pathItemOrRef] of Object.entries(spec.paths)) {
        if (!pathItemOrRef) continue;

        // Skip reference objects
        if ('$ref' in pathItemOrRef) continue;

        const pathItem = pathItemOrRef as OpenAPIV3.PathItemObject;

        const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as const;
        const methodsLower = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const;

        for (let i = 0; i < methodsLower.length; i++) {
          const method = methodsLower[i];
          const operation = pathItem[method] as OpenAPIV3.OperationObject | undefined;
          if (!operation) continue;

          operations.push({
            operationId: operation.operationId || `${method}_${path.replace(/\//g, '_')}`,
            method: methods[i],
            path,
            apiId,
            summary: operation.summary,
            description: operation.description,
            parameters: this.normalizeParameters(
              operation.parameters,
              pathItem.parameters
            ),
            requestBody: operation.requestBody as OpenAPIV3.RequestBodyObject | undefined,
            responses: operation.responses as Record<string, OpenAPIV3.ResponseObject>,
            tags: operation.tags,
            security: operation.security,
            callbacks: operation.callbacks as Record<string, OpenAPIV3.CallbackObject> | undefined,
            deprecated: operation.deprecated,
            externalDocs: operation.externalDocs,
          });
        }
      }
    }

    return {
      id: apiId,
      openApiVersion: spec.openapi,
      info: spec.info,
      servers: spec.servers || [],
      paths: (spec.paths || {}) as Record<string, OpenAPIV3.PathItemObject>,
      operations,
      components: spec.components || {},
      security: spec.security,
      tags: spec.tags,
      externalDocs: spec.externalDocs,
      rawSpec: spec,
      // Backward compatibility
      apiId,
      openapi: spec.openapi,
    };
  }

  /**
   * Normalize operation parameters
   */
  private normalizeParameters(
    operationParams?: (OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject)[],
    pathParams?: (OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject)[]
  ): ApiParameter[] {
    const params: ApiParameter[] = [];
    const allParams = [...(pathParams || []), ...(operationParams || [])];

    for (const param of allParams) {
      // Skip reference objects for now (should be resolved by SwaggerParser)
      if ('$ref' in param) continue;

      const paramObj = param as OpenAPIV3.ParameterObject;
      const schema = paramObj.schema as OpenAPIV3.SchemaObject | undefined;

      params.push({
        name: paramObj.name,
        in: paramObj.in as ApiParameter['in'],
        description: paramObj.description,
        required: paramObj.required || false,
        deprecated: paramObj.deprecated,
        allowEmptyValue: paramObj.allowEmptyValue,
        schema: schema || { type: 'string' },
        example: paramObj.example,
        examples: paramObj.examples as Record<string, OpenAPIV3.ExampleObject> | undefined,
        style: paramObj.style as ApiParameter['style'],
        explode: paramObj.explode,
        type: this.getParameterType(schema),
      });
    }

    return params;
  }

  /**
   * Get parameter type from schema
   */
  private getParameterType(
    schema?: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
  ): string {
    if (!schema) return 'unknown';
    if ('$ref' in schema) return 'reference';

    const schemaObj = schema as OpenAPIV3.SchemaObject;
    return schemaObj.type || 'unknown';
  }

  /**
   * Normalize shared entities across multiple APIs
   */
  private normalizeSharedEntities(specs: ApiSpec[]): Record<string, EntityDefinition> {
    const entityMap: Record<string, EntityDefinition> = {};

    // Common entity names to look for with their types
    const commonEntities: Array<{ name: string; type: EntityDefinition['type'] }> = [
      { name: 'Device', type: 'device' },
      { name: 'Alert', type: 'alert' },
      { name: 'Telemetry', type: 'telemetry' },
      { name: 'Event', type: 'event' },
      { name: 'Notification', type: 'other' },
    ];

    for (const spec of specs) {
      if (!spec.components?.schemas) continue;

      for (const { name: entityName, type: entityType } of commonEntities) {
        const schema = spec.components.schemas[entityName];
        if (!schema) continue;

        // Skip reference objects
        if ('$ref' in schema) continue;

        const schemaObj = schema as OpenAPIV3.SchemaObject;
        const schemaRef = `#/components/schemas/${entityName}`;

        if (!entityMap[entityName]) {
          entityMap[entityName] = {
            name: entityName,
            type: entityType,
            schema: schemaObj,
            referencedBy: [{ apiId: spec.id, operationIds: [], usage: 'both' }],
            isShared: false,
            originalRefs: [schemaRef],
            description: schemaObj.description,
          };
        } else {
          const entity = entityMap[entityName];
          entity.referencedBy.push({ apiId: spec.id, operationIds: [], usage: 'both' });
          entity.isShared = true;
          // schemaRef is always `#/components/schemas/${entityName}` — same value per entity name.
          // The first spec already inserted it, so this branch is a defensive dedup guard
          // that is structurally unreachable in normal operation.
          /* v8 ignore next */
          if (!entity.originalRefs.includes(schemaRef)) {
            /* v8 ignore next */
            entity.originalRefs.push(schemaRef);
          }

          // Merge schemas
          const merged = this.mergeSchemas(entity.schema, schemaObj);
          entity.schema = merged.schema;
        }
      }
    }

    return entityMap;
  }

  /**
   * Merge two schemas and detect conflicts
   */
  private mergeSchemas(
    schema1: OpenAPIV3.SchemaObject,
    schema2: OpenAPIV3.SchemaObject
  ): { schema: OpenAPIV3.SchemaObject; conflicts: string[] } {
    const conflicts: string[] = [];
    const merged: OpenAPIV3.SchemaObject = { ...schema1 };

    // Merge properties
    if (schema1.properties && schema2.properties) {
      merged.properties = { ...schema1.properties };

      for (const [key, value] of Object.entries(schema2.properties)) {
        if (merged.properties[key]) {
          // Check for conflicts
          const existing = merged.properties[key] as OpenAPIV3.SchemaObject;
          const incoming = value as OpenAPIV3.SchemaObject;

          if (existing.type !== incoming.type) {
            conflicts.push(
              `Property '${key}' has conflicting types: ${existing.type} vs ${incoming.type}`
            );
          }
        } else {
          merged.properties[key] = value;
        }
      }
    } else if (schema2.properties) {
      merged.properties = schema2.properties;
    }

    // Merge required fields
    if (schema1.required || schema2.required) {
      const requiredSet = new Set([
        ...(schema1.required || []),
        ...(schema2.required || []),
      ]);
      merged.required = Array.from(requiredSet);
    }

    return { schema: merged, conflicts };
  }

  /**
   * Compare parameters between old and new operations
   */
  private diffParameters(
    apiId: ApiId,
    oldOp: ApiOperation,
    newOp: ApiOperation
  ): BreakingChange[] {
    const changes: BreakingChange[] = [];

    const oldParamsMap = new Map(oldOp.parameters.map((p) => [p.name, p]));
    const newParamsMap = new Map(newOp.parameters.map((p) => [p.name, p]));

    // Check for removed parameters
    for (const [name, oldParam] of oldParamsMap) {
      const newParam = newParamsMap.get(name);

      if (!newParam) {
        if (oldParam.required) {
          changes.push({
            type: BreakingChangeType.REMOVED_PARAMETER,
            severity: 'major',
            apiId,
            operationId: oldOp.operationId,
            path: oldOp.path,
            method: oldOp.method as any,
            description: `Required parameter '${name}' was removed from ${oldOp.method} ${oldOp.path}`,
            affectedClients: [],
            oldValue: oldParam,
          });
        }
        continue;
      }

      // Check for type changes
      if (oldParam.type !== newParam.type) {
        changes.push({
          type: BreakingChangeType.PARAMETER_TYPE_CHANGED,
          severity: 'major',
          apiId,
          operationId: oldOp.operationId,
          path: oldOp.path,
          method: oldOp.method as any,
          description: `Parameter '${name}' type changed from '${oldParam.type}' to '${newParam.type}' in ${oldOp.method} ${oldOp.path}`,
          affectedClients: [],
          oldValue: oldParam.type,
          newValue: newParam.type,
        });
      }

      // Check if parameter became required
      if (!oldParam.required && newParam.required) {
        changes.push({
          type: BreakingChangeType.PARAMETER_REQUIRED_ADDED,
          severity: 'major',
          apiId,
          operationId: oldOp.operationId,
          path: oldOp.path,
          method: oldOp.method as any,
          description: `Parameter '${name}' is now required in ${oldOp.method} ${oldOp.path}`,
          affectedClients: [],
          oldValue: false,
          newValue: true,
        });
      }
    }

    return changes;
  }

  /**
   * Compare response schemas between old and new operations
   */
  private diffResponses(
    apiId: ApiId,
    oldOp: ApiOperation,
    newOp: ApiOperation
  ): BreakingChange[] {
    const changes: BreakingChange[] = [];

    // Focus on success responses (2xx)
    const successCodes = ['200', '201', '204'];

    for (const code of successCodes) {
      const oldResponse = oldOp.responses[code];
      const newResponse = newOp.responses[code];

      if (!oldResponse) continue;

      if (!newResponse) {
        changes.push({
          type: BreakingChangeType.RESPONSE_SCHEMA_CHANGED,
          severity: 'major',
          apiId,
          operationId: oldOp.operationId,
          path: oldOp.path,
          method: oldOp.method as any,
          description: `Response ${code} was removed from ${oldOp.method} ${oldOp.path}`,
          affectedClients: [],
        });
        continue;
      }

      // Compare schema if present
      const oldContent = oldResponse.content?.['application/json'];
      const newContent = newResponse.content?.['application/json'];

      if (oldContent?.schema && newContent?.schema) {
        const schemaChanges = this.compareSchemas(
          apiId,
          oldOp,
          oldContent.schema as OpenAPIV3.SchemaObject,
          newContent.schema as OpenAPIV3.SchemaObject
        );
        changes.push(...schemaChanges);
      }
    }

    return changes;
  }

  /**
   * Compare two schemas for breaking changes
   */
  private compareSchemas(
    apiId: ApiId,
    op: ApiOperation,
    oldSchema: OpenAPIV3.SchemaObject,
    newSchema: OpenAPIV3.SchemaObject
  ): BreakingChange[] {
    const changes: BreakingChange[] = [];

    // Check for removed required fields
    if (oldSchema.properties && newSchema.properties) {
      const oldRequired = new Set(oldSchema.required || []);

      for (const field of oldRequired) {
        if (!newSchema.properties[field]) {
          changes.push({
            type: BreakingChangeType.REMOVED_REQUIRED_FIELD,
            severity: 'major',
            apiId,
            operationId: op.operationId,
            path: op.path,
            method: op.method as any,
            description: `Required field '${field}' was removed from response schema in ${op.method} ${op.path}`,
            affectedClients: [],
            oldValue: oldSchema.properties[field],
          });
        }
      }

      // Check for type changes in existing fields
      for (const [field, oldProp] of Object.entries(oldSchema.properties)) {
        const newProp = newSchema.properties[field];
        if (!newProp) continue;

        const oldPropObj = oldProp as OpenAPIV3.SchemaObject;
        const newPropObj = newProp as OpenAPIV3.SchemaObject;

        if (oldPropObj.type && newPropObj.type && oldPropObj.type !== newPropObj.type) {
          changes.push({
            type: BreakingChangeType.RESPONSE_SCHEMA_CHANGED,
            severity: 'major',
            apiId,
            operationId: op.operationId,
            path: op.path,
            method: op.method as any,
            description: `Field '${field}' type changed from '${oldPropObj.type}' to '${newPropObj.type}' in response schema for ${op.method} ${op.path}`,
            affectedClients: [],
            oldValue: oldPropObj.type,
            newValue: newPropObj.type,
          });
        }
      }
    }

    return changes;
  }

  // Type-safe event emitter methods
  override emit<K extends keyof SwaggerIngestionEvents>(
    event: K,
    ...args: Parameters<SwaggerIngestionEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }

  override on<K extends keyof SwaggerIngestionEvents>(
    event: K,
    listener: SwaggerIngestionEvents[K]
  ): this {
    return super.on(event, listener);
  }

  override once<K extends keyof SwaggerIngestionEvents>(
    event: K,
    listener: SwaggerIngestionEvents[K]
  ): this {
    return super.once(event, listener);
  }

  override off<K extends keyof SwaggerIngestionEvents>(
    event: K,
    listener: SwaggerIngestionEvents[K]
  ): this {
    return super.off(event, listener);
  }
}

/**
 * Export convenience function to create service instance
 */
export function createSwaggerIngestionService(
  authAdapter?: FriendlyAuthAdapter
): SwaggerIngestionService {
  return new SwaggerIngestionService(authAdapter);
}
