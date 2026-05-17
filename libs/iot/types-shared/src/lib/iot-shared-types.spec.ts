import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  ApiId,
  ApiOperation,
  ApiParameter,
  ApiSpec,
  EntityDefinition,
  FriendlyAuthAdapterInterface,
  Operation,
  ParameterStyle,
  UnifiedApiModel,
} from './iot-shared-types';

describe('iot-shared-types', () => {
  it('ApiId is one of the documented identifiers', () => {
    expectTypeOf<ApiId>().toEqualTypeOf<'northbound' | 'events' | 'qoe'>();
  });

  it('ApiOperation is a backwards-compatible alias of Operation', () => {
    expectTypeOf<ApiOperation>().toEqualTypeOf<Operation>();
  });

  it('FriendlyAuthAdapterInterface exposes the public auth surface', () => {
    const stub: FriendlyAuthAdapterInterface = {
      isInitialized: () => true,
      getTenantId: () => 't',
      getAuthHeaders: async () => ({}),
      handle401: async () => undefined,
    };
    expect(stub.isInitialized()).toBe(true);
  });

  it('Operation method is one of the documented HTTP verbs', () => {
    expectTypeOf<Operation['method']>().toEqualTypeOf<
      | 'GET'
      | 'POST'
      | 'PUT'
      | 'DELETE'
      | 'PATCH'
      | 'HEAD'
      | 'OPTIONS'
      | 'TRACE'
    >();
  });

  it('ApiParameter.in restricts to the documented locations', () => {
    expectTypeOf<ApiParameter['in']>().toEqualTypeOf<
      'query' | 'header' | 'path' | 'cookie'
    >();
  });

  it('ParameterStyle is exhaustive', () => {
    expectTypeOf<ParameterStyle>().toEqualTypeOf<
      | 'matrix'
      | 'label'
      | 'form'
      | 'simple'
      | 'spaceDelimited'
      | 'pipeDelimited'
      | 'deepObject'
    >();
  });

  it('EntityDefinition.type is the documented enum of entity kinds', () => {
    expectTypeOf<EntityDefinition['type']>().toEqualTypeOf<
      'device' | 'alert' | 'telemetry' | 'event' | 'configuration' | 'user' | 'other'
    >();
  });

  it('ApiSpec + UnifiedApiModel compose without surprises', () => {
    // Compile-time only — the assignment validates the structural shape.
    const model = {
      apis: {} as Record<ApiId, ApiSpec>,
      sharedEntities: {},
      operations: [],
      metadata: { generatedAt: '2026-05-14T00:00:00Z' },
    } satisfies UnifiedApiModel;
    expect(model.metadata.generatedAt).toBe('2026-05-14T00:00:00Z');
  });
});
