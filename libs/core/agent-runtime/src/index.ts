export const MODULE_NAME = 'agent-runtime';

// Canonical AEP v2 LangGraph stream contract (9-kind taxonomy)
export type {
  StreamChunk as LangGraphStreamChunk,
  StreamChunkKind as LangGraphStreamChunkKind,
  StreamChunkPayload as LangGraphStreamChunkPayload,
} from './lib/contracts';
export { STREAM_CHUNK_KINDS } from './lib/contracts';

// Deterministic dev-mode fixture loop
export {
  RUN_FIXTURE,
  RUN_FIXTURE_CYCLE_MS,
  RUN_FIXTURE_STEP_MS,
} from './mocks/run.fixture';

// Export all types
export type {
  TaskStatus,
  BuildTask,
  GeneratedAsset,
  AgentError,
  ApprovalStatus,
  ApprovalRequest,
  AEPAgentState,
  SupervisorOutput,
  AgentConfig,
} from './lib/types';

export { AgentRole } from './lib/types';

// Export all constants
export {
  SUPERVISOR_PROMPT,
  PLANNING_PROMPT,
  IOT_DOMAIN_PROMPT,
  DEFAULT_AGENT_CONFIG,
  AGENT_ROLE_NAMES,
  TASK_TYPES,
  APPROVAL_TYPES,
} from './lib/constants';

// Export agent nodes
export { createSupervisorNode } from './lib/agents/supervisor';
export { createPlanningNode } from './lib/agents/planning';
export { createIoTDomainNode } from './lib/agents/iot-domain';

// Export graph and graph types
export {
  createAgentGraph,
  type GraphConfig,
  type CompiledGraph,
} from './lib/graph';

// Export checkpointer
export type {
  CheckpointerConfig,
  CheckpointerInstance,
} from './lib/checkpointer';
export {
  createCheckpointer,
  closeCheckpointer,
  createCheckpointerFromEnv,
} from './lib/checkpointer';

// Export streaming interface
export type {
  StreamConfig,
  StreamChunk,
  StreamChunkType,
  MessageChunk,
  StateUpdateChunk,
  AgentThinkingChunk,
  AgentToolCallChunk,
  AgentResponseChunk,
  BuildProgressChunk,
  TaskUpdateChunk,
  ErrorChunk,
  CompletionChunk,
} from './lib/streaming';
export {
  AgentStream,
  streamAgentResponse,
  sendChunkToWebSocket,
  createMockGraph,
} from './lib/streaming';
