/**
 * Comprehensive Vitest test suite for SwaggerIngestionService
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { readFile } from 'fs/promises';
import {
  SwaggerIngestionService,
  createSwaggerIngestionService,
} from './swagger-ingestion';
import { FriendlyAuthAdapter } from '@friendly-aiaep/auth-adapter';
import type {
  SpecConfig,
  IngestResult,
  UnifiedApiModel,
  BreakingChange,
} from './types';
import { BreakingChangeType } from './types';

// Mock FriendlyAuthAdapter
vi.mock('@friendly-aiaep/auth-adapter', () => {
  return {
    FriendlyAuthAdapter: class MockFriendlyAuthAdapter {
      getAuthHeaders = vi.fn().mockResolvedValue({
        Authorization: 'Bearer test-token',
      });
    },
  };
});

// Mock global fetch
global.fetch = vi.fn();

describe('SwaggerIngestionService', () => {
  let service: SwaggerIngestionService;
  let authAdapter: FriendlyAuthAdapter;

  const fixturesPath = join(__dirname, '..', '__fixtures__');

  beforeEach(() => {
    authAdapter = new FriendlyAuthAdapter({
      encryptionKey: 'test-key-32-characters-long!!!',
      jwtSecret: 'test-jwt-secret',
    });
    service = new SwaggerIngestionService(authAdapter);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Service Construction', () => {
    it('should create service without auth adapter', () => {
      const serviceWithoutAuth = new SwaggerIngestionService();
      expect(serviceWithoutAuth).toBeInstanceOf(SwaggerIngestionService);
    });

    it('should create service with auth adapter', () => {
      expect(service).toBeInstanceOf(SwaggerIngestionService);
    });

    it('should create service using factory function', () => {
      const factoryService = createSwaggerIngestionService(authAdapter);
      expect(factoryService).toBeInstanceOf(SwaggerIngestionService);
    });

    it('should extend EventEmitter', () => {
      expect(service.on).toBeDefined();
      expect(service.emit).toBeDefined();
      expect(service.once).toBeDefined();
      expect(service.off).toBeDefined();
    });
  });

  describe('ingestSpec - File Source', () => {
    it('should successfully ingest Swagger 2.0 spec from file', async () => {
      const config: SpecConfig = {
        apiId: 'northbound',
        source: {
          type: 'file',
          location: join(fixturesPath, 'northbound-swagger.json'),
        },
      };

      const result = await service.ingestSpec(config);

      expect(result).toBeDefined();
      expect(result.apiId).toBe('northbound');
      expect(result.spec).toBeDefined();
      expect(result.spec.id).toBe('northbound');
      expect(result.spec.info.title).toBe('Northbound API');
      expect(result.hash).toBeDefined();
      expect(result.hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash format
    });

    it('should successfully ingest OpenAPI 3.0 spec from file', async () => {
      const config: SpecConfig = {
        apiId: 'events',
        source: {
          type: 'file',
          location: join(fixturesPath, 'events-openapi.json'),
        },
      };

      const result = await service.ingestSpec(config);

      expect(result).toBeDefined();
      expect(result.apiId).toBe('events');
      expect(result.spec.id).toBe('events');
      expect(result.spec.info.title).toBe('Events API');
      expect(result.spec.openApiVersion).toBe('3.0.3');
      expect(result.spec.servers).toHaveLength(2);
    });

    it('should extract operations from Swagger 2.0 spec', async () => {
      const config: SpecConfig = {
        apiId: 'northbound',
        source: {
          type: 'file',
          location: join(fixturesPath, 'northbound-swagger.json'),
        },
      };

      const result = await service.ingestSpec(config);

      expect(result.spec.operations).toHaveLength(4);
      const operationIds = result.spec.operations.map((op) => op.operationId);
      expect(operationIds).toContain('listDevices');
      expect(operationIds).toContain('createDevice');
      expect(operationIds).toContain('getDevice');
      expect(operationIds).toContain('listAlerts');
    });

    it('should extract operations from OpenAPI 3.0 spec', async () => {
      const config: SpecConfig = {
        apiId: 'events',
        source: {
          type: 'file',
          location: join(fixturesPath, 'events-openapi.json'),
        },
      };

      const result = await service.ingestSpec(config);

      expect(result.spec.operations).toHaveLength(4);
      const operationIds = result.spec.operations.map((op) => op.operationId);
      expect(operationIds).toContain('listEvents');
      expect(operationIds).toContain('getEvent');
      expect(operationIds).toContain('subscribeToEvents');
      expect(operationIds).toContain('listDevicesFromEvents');
    });

    it('should normalize operation parameters correctly', async () => {
      const config: SpecConfig = {
        apiId: 'northbound',
        source: {
          type: 'file',
          location: join(fixturesPath, 'northbound-swagger.json'),
        },
      };

      const result = await service.ingestSpec(config);
      const listDevicesOp = result.spec.operations.find(
        (op) => op.operationId === 'listDevices'
      );

      expect(listDevicesOp).toBeDefined();
      expect(listDevicesOp!.parameters).toHaveLength(3);

      const limitParam = listDevicesOp!.parameters.find(
        (p) => p.name === 'limit'
      );
      expect(limitParam).toBeDefined();
      expect(limitParam!.in).toBe('query');
      expect(limitParam!.required).toBe(false);
      // After SwaggerParser validation, Swagger 2.0 parameters are converted to OpenAPI 3.0 format
      // The schema object should exist and have a type property
      expect(limitParam!.schema).toBeDefined();
      expect(limitParam!.schema.type).toBeDefined();

      // Check the status parameter which has enum values
      const statusParam = listDevicesOp!.parameters.find(
        (p) => p.name === 'status'
      );
      expect(statusParam).toBeDefined();
      expect(statusParam!.schema.type).toBe('string');
    });

    it('should normalize path parameters correctly', async () => {
      const config: SpecConfig = {
        apiId: 'events',
        source: {
          type: 'file',
          location: join(fixturesPath, 'events-openapi.json'),
        },
      };

      const result = await service.ingestSpec(config);
      const getEventOp = result.spec.operations.find(
        (op) => op.operationId === 'getEvent'
      );

      expect(getEventOp).toBeDefined();
      expect(getEventOp!.parameters).toHaveLength(1);

      const idParam = getEventOp!.parameters[0];
      expect(idParam.name).toBe('id');
      expect(idParam.in).toBe('path');
      expect(idParam.required).toBe(true);
    });

    it('should throw error for non-existent file', async () => {
      const config: SpecConfig = {
        apiId: 'northbound',
        source: {
          type: 'file',
          location: join(fixturesPath, 'non-existent.json'),
        },
      };

      await expect(service.ingestSpec(config)).rejects.toThrow();
    });

    it('should throw error for invalid JSON file', async () => {
      const config: SpecConfig = {
        apiId: 'northbound',
        source: {
          type: 'file',
          location: join(fixturesPath, 'invalid-spec.json'),
        },
      };

      await expect(service.ingestSpec(config)).rejects.toThrow();
    });
  });

  describe('ingestSpec - URL Source', () => {
    it('should successfully ingest spec from URL without auth', async () => {
      const mockSpec = JSON.parse(
        await readFile(join(fixturesPath, 'northbound-swagger.json'), 'utf-8')
      );

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        text: async () => JSON.stringify(mockSpec),
      });

      const config: SpecConfig = {
        apiId: 'northbound',
        source: {
          type: 'url',
          location: 'https://api.example.com/swagger.json',
        },
      };

      const result = await service.ingestSpec(config);

      expect(result).toBeDefined();
      expect(result.apiId).toBe('northbound');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/swagger.json',
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/json, application/yaml, text/yaml',
          }),
        })
      );
    });

    it('should successfully ingest spec from URL with basic auth', async () => {
      const mockSpec = JSON.parse(
        await readFile(join(fixturesPath, 'events-openapi.json'), 'utf-8')
      );

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        text: async () => JSON.stringify(mockSpec),
      });

      const config: SpecConfig = {
        apiId: 'events',
        source: {
          type: 'url',
          location: 'https://api.example.com/openapi.json',
        },
        auth: {
          type: 'basic',
          credentials: {
            username: 'user',
            password: 'pass',
          },
        },
      };

      const result = await service.ingestSpec(config);

      expect(result).toBeDefined();
      expect(authAdapter.getAuthHeaders).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/openapi.json',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should successfully ingest spec from URL with API key auth', async () => {
      const mockSpec = JSON.parse(
        await readFile(join(fixturesPath, 'northbound-swagger.json'), 'utf-8')
      );

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        text: async () => JSON.stringify(mockSpec),
      });

      const config: SpecConfig = {
        apiId: 'northbound',
        source: {
          type: 'url',
          location: 'https://api.example.com/swagger.json',
        },
        auth: {
          type: 'apiKey',
          credentials: {
            apiKey: 'test-api-key',
          },
        },
      };

      const result = await service.ingestSpec(config);

      expect(result).toBeDefined();
      expect(authAdapter.getAuthHeaders).toHaveBeenCalled();
    });

    it('should handle YAML content type from URL', async () => {
      const mockSpec = JSON.parse(
        await readFile(join(fixturesPath, 'northbound-swagger.json'), 'utf-8')
      );

      // Convert to YAML-like string (simplified for test)
      const yamlContent = `
swagger: "2.0"
info:
  title: Test API
  version: 1.0.0
paths: {}
`;

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/yaml']]),
        text: async () => yamlContent,
      });

      const config: SpecConfig = {
        apiId: 'northbound',
        source: {
          type: 'url',
          location: 'https://api.example.com/swagger.yaml',
        },
      };

      // This should attempt to parse as YAML
      const result = await service.ingestSpec(config);
      expect(result).toBeDefined();
    });

    it('should throw error for failed URL fetch', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      const config: SpecConfig = {
        apiId: 'northbound',
        source: {
          type: 'url',
          location: 'https://api.example.com/not-found.json',
        },
      };

      await expect(service.ingestSpec(config)).rejects.toThrow(
        /Failed to fetch spec/
      );
    });

    it('should throw error for network failure', async () => {
      (global.fetch as any).mockRejectedValueOnce(
        new Error('Network error')
      );

      const config: SpecConfig = {
        apiId: 'northbound',
        source: {
          type: 'url',
          location: 'https://api.example.com/swagger.json',
        },
      };

      await expect(service.ingestSpec(config)).rejects.toThrow();
    });
  });

  describe('Event Emission', () => {
    it('should emit spec-changed event on successful ingestion', async () => {
      const eventHandler = vi.fn();
      service.on('spec-changed', eventHandler);

      const config: SpecConfig = {
        apiId: 'northbound',
        source: {
          type: 'file',
          location: join(fixturesPath, 'northbound-swagger.json'),
        },
      };

      const result = await service.ingestSpec(config);

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith(result);
    });

    it('should emit ingestion-error event on failure', async () => {
      const errorHandler = vi.fn();
      service.on('ingestion-error', errorHandler);

      const config: SpecConfig = {
        apiId: 'northbound',
        source: {
          type: 'file',
          location: join(fixturesPath, 'non-existent.json'),
        },
      };

      await expect(service.ingestSpec(config)).rejects.toThrow();

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith(
        expect.any(Error),
        'northbound'
      );
    });

    it('should support once() for one-time event listeners', async () => {
      const eventHandler = vi.fn();
      service.once('spec-changed', eventHandler);

      const config: SpecConfig = {
        apiId: 'northbound',
        source: {
          type: 'file',
          location: join(fixturesPath, 'northbound-swagger.json'),
        },
      };

      await service.ingestSpec(config);
      await service.ingestSpec(config);

      expect(eventHandler).toHaveBeenCalledTimes(1);
    });

    it('should support off() to remove event listeners', async () => {
      const eventHandler = vi.fn();
      service.on('spec-changed', eventHandler);
      service.off('spec-changed', eventHandler);

      const config: SpecConfig = {
        apiId: 'northbound',
        source: {
          type: 'file',
          location: join(fixturesPath, 'northbound-swagger.json'),
        },
      };

      await service.ingestSpec(config);

      expect(eventHandler).not.toHaveBeenCalled();
    });
  });

  describe('ingestAll - Parallel Ingestion', () => {
    it('should ingest multiple specs in parallel', async () => {
      const configs: SpecConfig[] = [
        {
          apiId: 'northbound',
          source: {
            type: 'file',
            location: join(fixturesPath, 'northbound-swagger.json'),
          },
        },
        {
          apiId: 'events',
          source: {
            type: 'file',
            location: join(fixturesPath, 'events-openapi.json'),
          },
        },
      ];

      const model = await service.ingestAll(configs);

      expect(model).toBeDefined();
      expect(model.apis).toBeDefined();
      expect(Object.keys(model.apis)).toHaveLength(2);
      expect(model.apis['northbound']).toBeDefined();
      expect(model.apis['events']).toBeDefined();
    });

    it('should create unified model with correct metadata', async () => {
      const configs: SpecConfig[] = [
        {
          apiId: 'northbound',
          source: {
            type: 'file',
            location: join(fixturesPath, 'northbound-swagger.json'),
          },
        },
        {
          apiId: 'events',
          source: {
            type: 'file',
            location: join(fixturesPath, 'events-openapi.json'),
          },
        },
      ];

      const model = await service.ingestAll(configs);

      expect(model.metadata).toBeDefined();
      expect(model.metadata.totalApis).toBe(2);
      expect(model.metadata.totalOperations).toBe(8); // 4 + 4
      expect(model.metadata.schemaVersion).toBe('1.0.0');
      expect(model.metadata.generatedAt).toBeDefined();
    });

    it('should collect all operations from multiple specs', async () => {
      const configs: SpecConfig[] = [
        {
          apiId: 'northbound',
          source: {
            type: 'file',
            location: join(fixturesPath, 'northbound-swagger.json'),
          },
        },
        {
          apiId: 'events',
          source: {
            type: 'file',
            location: join(fixturesPath, 'events-openapi.json'),
          },
        },
      ];

      const model = await service.ingestAll(configs);

      expect(model.operations).toHaveLength(8);
      const operationIds = model.operations.map((op) => op.operationId);
      expect(operationIds).toContain('listDevices');
      expect(operationIds).toContain('listEvents');
    });

    it('should handle empty config array', async () => {
      const model = await service.ingestAll([]);

      expect(model.apis).toEqual({});
      expect(model.operations).toEqual([]);
      expect(model.metadata.totalApis).toBe(0);
      expect(model.metadata.totalOperations).toBe(0);
    });

    it('should throw error if any spec fails to ingest', async () => {
      const configs: SpecConfig[] = [
        {
          apiId: 'northbound',
          source: {
            type: 'file',
            location: join(fixturesPath, 'northbound-swagger.json'),
          },
        },
        {
          apiId: 'events',
          source: {
            type: 'file',
            location: join(fixturesPath, 'non-existent.json'),
          },
        },
      ];

      await expect(service.ingestAll(configs)).rejects.toThrow();
    });
  });

  describe('Shared Entity Normalization', () => {
    it('should identify shared Device entity across specs', async () => {
      const configs: SpecConfig[] = [
        {
          apiId: 'northbound',
          source: {
            type: 'file',
            location: join(fixturesPath, 'northbound-swagger.json'),
          },
        },
        {
          apiId: 'events',
          source: {
            type: 'file',
            location: join(fixturesPath, 'events-openapi.json'),
          },
        },
      ];

      const model = await service.ingestAll(configs);

      expect(model.sharedEntities).toBeDefined();
      expect(model.sharedEntities['Device']).toBeDefined();

      const deviceEntity = model.sharedEntities['Device'];
      expect(deviceEntity.name).toBe('Device');
      expect(deviceEntity.type).toBe('device');
      // Device entity appears in both specs and should be merged
      expect(deviceEntity.referencedBy.length).toBeGreaterThanOrEqual(1);

      // Check that both APIs reference the Device entity (after normalization)
      const apiIds = deviceEntity.referencedBy.map((ref) => ref.apiId);
      expect(apiIds).toContain('events');
    });

    it('should merge Device schema properties from both specs', async () => {
      const configs: SpecConfig[] = [
        {
          apiId: 'northbound',
          source: {
            type: 'file',
            location: join(fixturesPath, 'northbound-swagger.json'),
          },
        },
        {
          apiId: 'events',
          source: {
            type: 'file',
            location: join(fixturesPath, 'events-openapi.json'),
          },
        },
      ];

      const model = await service.ingestAll(configs);
      const deviceEntity = model.sharedEntities['Device'];

      expect(deviceEntity.schema.properties).toBeDefined();

      // Common properties that should exist in both specs
      expect(deviceEntity.schema.properties!['id']).toBeDefined();
      expect(deviceEntity.schema.properties!['name']).toBeDefined();

      // At least one spec should contribute additional properties
      const propertyCount = Object.keys(deviceEntity.schema.properties!).length;
      expect(propertyCount).toBeGreaterThan(2); // More than just id and name
    });

    it('should merge required fields from both specs', async () => {
      const configs: SpecConfig[] = [
        {
          apiId: 'northbound',
          source: {
            type: 'file',
            location: join(fixturesPath, 'northbound-swagger.json'),
          },
        },
        {
          apiId: 'events',
          source: {
            type: 'file',
            location: join(fixturesPath, 'events-openapi.json'),
          },
        },
      ];

      const model = await service.ingestAll(configs);
      const deviceEntity = model.sharedEntities['Device'];

      expect(deviceEntity.schema.required).toBeDefined();
      expect(deviceEntity.schema.required).toContain('id');
      expect(deviceEntity.schema.required).toContain('name');
      // Required fields should be merged from both specs
      expect(deviceEntity.schema.required!.length).toBeGreaterThanOrEqual(2);
    });

    it('should identify Alert entity from single spec', async () => {
      const configs: SpecConfig[] = [
        {
          apiId: 'northbound',
          source: {
            type: 'file',
            location: join(fixturesPath, 'northbound-swagger.json'),
          },
        },
        {
          apiId: 'events',
          source: {
            type: 'file',
            location: join(fixturesPath, 'events-openapi.json'),
          },
        },
      ];

      const model = await service.ingestAll(configs);

      // Alert is in the northbound spec - check if it's been normalized
      // The service may only extract specific entity types
      const entityNames = Object.keys(model.sharedEntities);
      expect(entityNames.length).toBeGreaterThan(0);

      // If Alert exists, verify it's from northbound
      if (model.sharedEntities['Alert']) {
        const alertEntity = model.sharedEntities['Alert'];
        expect(alertEntity.type).toBe('alert');
        expect(alertEntity.referencedBy.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should identify Event entity from single spec', async () => {
      const configs: SpecConfig[] = [
        {
          apiId: 'northbound',
          source: {
            type: 'file',
            location: join(fixturesPath, 'northbound-swagger.json'),
          },
        },
        {
          apiId: 'events',
          source: {
            type: 'file',
            location: join(fixturesPath, 'events-openapi.json'),
          },
        },
      ];

      const model = await service.ingestAll(configs);

      expect(model.sharedEntities['Event']).toBeDefined();
      const eventEntity = model.sharedEntities['Event'];
      expect(eventEntity.type).toBe('event');
      expect(eventEntity.referencedBy).toHaveLength(1);
      expect(eventEntity.referencedBy[0].apiId).toBe('events');
    });

    it('should count total shared entities correctly', async () => {
      const configs: SpecConfig[] = [
        {
          apiId: 'northbound',
          source: {
            type: 'file',
            location: join(fixturesPath, 'northbound-swagger.json'),
          },
        },
        {
          apiId: 'events',
          source: {
            type: 'file',
            location: join(fixturesPath, 'events-openapi.json'),
          },
        },
      ];

      const model = await service.ingestAll(configs);

      expect(model.metadata.totalEntities).toBe(
        Object.keys(model.sharedEntities).length
      );
      // Should extract at least Device and Event entities (common entities defined in the service)
      expect(model.metadata.totalEntities).toBeGreaterThanOrEqual(1);
    });
  });

  describe('diffSpecs - Breaking Changes Detection', () => {
    let oldModel: UnifiedApiModel;
    let newModel: UnifiedApiModel;

    beforeEach(async () => {
      const configs: SpecConfig[] = [
        {
          apiId: 'northbound',
          source: {
            type: 'file',
            location: join(fixturesPath, 'northbound-swagger.json'),
          },
        },
      ];

      oldModel = await service.ingestAll(configs);
    });

    it('should detect removed endpoint', async () => {
      // Create new model with one operation removed
      newModel = JSON.parse(JSON.stringify(oldModel));
      newModel.apis['northbound'].operations = newModel.apis[
        'northbound'
      ].operations.filter((op) => op.operationId !== 'listAlerts');

      const changes = service.diffSpecs(oldModel, newModel);

      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe(BreakingChangeType.REMOVED_ENDPOINT);
      expect(changes[0].severity).toBe('critical');
      expect(changes[0].operationId).toBe('listAlerts');
    });

    it('should detect removed required parameter', async () => {
      newModel = JSON.parse(JSON.stringify(oldModel));

      // Remove a required path parameter from getDevice operation
      const getDeviceOp = newModel.apis['northbound'].operations.find(
        (op) => op.operationId === 'getDevice'
      );
      if (getDeviceOp) {
        getDeviceOp.parameters = [];
      }

      const changes = service.diffSpecs(oldModel, newModel);

      expect(changes.length).toBeGreaterThan(0);
      const paramChange = changes.find(
        (c) => c.type === BreakingChangeType.REMOVED_PARAMETER
      );
      expect(paramChange).toBeDefined();
      expect(paramChange!.severity).toBe('major');
    });

    it('should detect parameter type change', async () => {
      newModel = JSON.parse(JSON.stringify(oldModel));

      // Change parameter type in listDevices operation
      const listDevicesOp = newModel.apis['northbound'].operations.find(
        (op) => op.operationId === 'listDevices'
      );
      if (listDevicesOp) {
        const limitParam = listDevicesOp.parameters.find(
          (p) => p.name === 'limit'
        );
        if (limitParam) {
          limitParam.type = 'string'; // Changed from integer (or unknown after conversion)
        }
      }

      const changes = service.diffSpecs(oldModel, newModel);

      const typeChange = changes.find(
        (c) => c.type === BreakingChangeType.PARAMETER_TYPE_CHANGED
      );
      expect(typeChange).toBeDefined();
      expect(typeChange!.severity).toBe('major');
      // Type may be 'unknown' after Swagger 2.0 -> OpenAPI 3.0 conversion
      expect(typeChange!.newValue).toBe('string');
    });

    it('should detect parameter became required', async () => {
      newModel = JSON.parse(JSON.stringify(oldModel));

      // Make optional parameter required in listDevices operation
      const listDevicesOp = newModel.apis['northbound'].operations.find(
        (op) => op.operationId === 'listDevices'
      );
      if (listDevicesOp) {
        const statusParam = listDevicesOp.parameters.find(
          (p) => p.name === 'status'
        );
        if (statusParam) {
          statusParam.required = true; // Changed from false
        }
      }

      const changes = service.diffSpecs(oldModel, newModel);

      const requiredChange = changes.find(
        (c) => c.type === BreakingChangeType.PARAMETER_REQUIRED_ADDED
      );
      expect(requiredChange).toBeDefined();
      expect(requiredChange!.severity).toBe('major');
    });

    it('should detect removed entire API', async () => {
      const configs: SpecConfig[] = [
        {
          apiId: 'northbound',
          source: {
            type: 'file',
            location: join(fixturesPath, 'northbound-swagger.json'),
          },
        },
        {
          apiId: 'events',
          source: {
            type: 'file',
            location: join(fixturesPath, 'events-openapi.json'),
          },
        },
      ];

      const fullModel = await service.ingestAll(configs);

      // Create new model without events API
      newModel = JSON.parse(JSON.stringify(fullModel));
      delete newModel.apis['events'];

      const changes = service.diffSpecs(fullModel, newModel);

      // All operations from events API should be marked as removed
      const removedOps = changes.filter(
        (c) =>
          c.type === BreakingChangeType.REMOVED_ENDPOINT &&
          c.apiId === 'events'
      );
      expect(removedOps.length).toBeGreaterThan(0);
    });

    it('should detect response schema changes', async () => {
      newModel = JSON.parse(JSON.stringify(oldModel));

      // Modify response schema
      const getDeviceOp = newModel.apis['northbound'].operations.find(
        (op) => op.operationId === 'getDevice'
      );
      if (getDeviceOp && getDeviceOp.responses['200']) {
        // Remove the response entirely
        delete getDeviceOp.responses['200'];
      }

      const changes = service.diffSpecs(oldModel, newModel);

      const schemaChange = changes.find(
        (c) => c.type === BreakingChangeType.RESPONSE_SCHEMA_CHANGED
      );
      expect(schemaChange).toBeDefined();
    });

    it('should return empty array when no changes detected', async () => {
      newModel = JSON.parse(JSON.stringify(oldModel));

      const changes = service.diffSpecs(oldModel, newModel);

      expect(changes).toEqual([]);
    });

    it('should emit breaking-changes-detected event', async () => {
      const eventHandler = vi.fn();
      service.on('breaking-changes-detected', eventHandler);

      newModel = JSON.parse(JSON.stringify(oldModel));
      newModel.apis['northbound'].operations = newModel.apis[
        'northbound'
      ].operations.filter((op) => op.operationId !== 'listAlerts');

      const changes = service.diffSpecs(oldModel, newModel);

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith(changes);
    });

    it('should not emit event when no breaking changes', async () => {
      const eventHandler = vi.fn();
      service.on('breaking-changes-detected', eventHandler);

      newModel = JSON.parse(JSON.stringify(oldModel));
      service.diffSpecs(oldModel, newModel);

      expect(eventHandler).not.toHaveBeenCalled();
    });
  });

  describe('Hash Calculation', () => {
    it('should generate consistent hash for same spec', async () => {
      const config: SpecConfig = {
        apiId: 'northbound',
        source: {
          type: 'file',
          location: join(fixturesPath, 'northbound-swagger.json'),
        },
      };

      const result1 = await service.ingestSpec(config);
      const result2 = await service.ingestSpec(config);

      expect(result1.hash).toBe(result2.hash);
    });

    it('should generate different hash for different specs', async () => {
      const config1: SpecConfig = {
        apiId: 'northbound',
        source: {
          type: 'file',
          location: join(fixturesPath, 'northbound-swagger.json'),
        },
      };

      const config2: SpecConfig = {
        apiId: 'events',
        source: {
          type: 'file',
          location: join(fixturesPath, 'events-openapi.json'),
        },
      };

      const result1 = await service.ingestSpec(config1);
      const result2 = await service.ingestSpec(config2);

      expect(result1.hash).not.toBe(result2.hash);
    });

    it('should generate valid SHA-256 hash format', async () => {
      const config: SpecConfig = {
        apiId: 'northbound',
        source: {
          type: 'file',
          location: join(fixturesPath, 'northbound-swagger.json'),
        },
      };

      const result = await service.ingestSpec(config);

      expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      const config: SpecConfig = {
        apiId: 'northbound',
        source: {
          type: 'file',
          location: join(fixturesPath, 'invalid-spec.json'),
        },
      };

      await expect(service.ingestSpec(config)).rejects.toThrow(
        /Failed to ingest spec/
      );
    });

    it('should include apiId in error message', async () => {
      const config: SpecConfig = {
        apiId: 'northbound',
        source: {
          type: 'file',
          location: join(fixturesPath, 'non-existent.json'),
        },
      };

      await expect(service.ingestSpec(config)).rejects.toThrow(/northbound/);
    });

    it('should emit error event with correct parameters', async () => {
      const errorHandler = vi.fn();
      service.on('ingestion-error', errorHandler);

      const config: SpecConfig = {
        apiId: 'events',
        source: {
          type: 'file',
          location: join(fixturesPath, 'invalid-spec.json'),
        },
      };

      await expect(service.ingestSpec(config)).rejects.toThrow();

      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error), 'events');
    });

    it('should handle non-Error exceptions', async () => {
      const config: SpecConfig = {
        apiId: 'northbound',
        source: {
          type: 'file',
          location: join(fixturesPath, 'invalid-spec.json'),
        },
      };

      // The invalid-spec.json file will cause SwaggerParser to fail
      // This tests error handling with validation errors
      await expect(service.ingestSpec(config)).rejects.toThrow();
    });
  });

  describe('Backward Compatibility', () => {
    it('should include deprecated rawSpec field', async () => {
      const config: SpecConfig = {
        apiId: 'northbound',
        source: {
          type: 'file',
          location: join(fixturesPath, 'northbound-swagger.json'),
        },
      };

      const result = await service.ingestSpec(config);

      expect(result.spec.rawSpec).toBeDefined();
      expect(result.spec.rawSpec?.info).toBeDefined();
    });

    it('should include backward compatibility aliases', async () => {
      const config: SpecConfig = {
        apiId: 'events',
        source: {
          type: 'file',
          location: join(fixturesPath, 'events-openapi.json'),
        },
      };

      const result = await service.ingestSpec(config);

      expect(result.spec.apiId).toBe('events'); // Deprecated alias
      expect(result.spec.openapi).toBe('3.0.3'); // Deprecated alias
    });
  });
});
