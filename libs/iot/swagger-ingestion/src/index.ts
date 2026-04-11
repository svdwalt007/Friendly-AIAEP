export const MODULE_NAME = 'swagger-ingestion';

// Main service
export {
  SwaggerIngestionService,
  createSwaggerIngestionService,
} from './lib/swagger-ingestion';

// Hash storage utility
export { SpecHashStorage } from './lib/hash-storage';

// Types
export type {
  ApiId,
  SpecSourceType,
  AuthConfig,
  OAuth2Config,
  SpecConfig,
  ParameterStyle,
  ApiParameter,
  Operation,
  ApiOperation,
  ApiSpec,
  EntityDefinition,
  IngestResult,
  IngestionResult,
  SharedEntity,
  UnifiedApiModel,
  BreakingChange,
  NonBreakingChange,
  ApiDiff,
  ValidationResult,
  SwaggerIngestionEvents,
  IngestionOptions,
  EntityType,
  EntityUsage,
  EntityRelationship,
  Severity,
} from './lib/types';

export { BreakingChangeType } from './lib/types';
