/**
 * @fileoverview LangGraph StateGraph workflow for AEP Multi-Agent System
 * @module @friendly-tech/core/agent-runtime
 *
 * Defines the core graph structure for the multi-agent system, orchestrating
 * the flow between the Supervisor, Planning, and IoT Domain agents.
 *
 * Uses the LangGraph 0.0.12 `channels`-based StateGraph API.
 */

import {
  StateGraph,
  START,
  END,
} from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';
import type { BaseCheckpointSaver } from '@langchain/langgraph';
import type {
  SupervisorOutput,
  BuildTask,
  GeneratedAsset,
  AgentError,
  ApprovalRequest,
  AEPAgentState,
} from './types';
import { AgentRole } from './types';
import { createSupervisorNode } from './agents/supervisor';
import { createPlanningNode } from './agents/planning';
import { createIoTDomainNode } from './agents/iot-domain';
import type { ToolConfig } from '@friendly-tech/iot/iot-tool-functions';

/**
 * Configuration options for the agent graph
 */
export interface GraphConfig {
  /**
   * Optional checkpointer for persisting conversation state.
   * Enables conversation history, resume, and time-travel debugging.
   */
  checkpointer?: BaseCheckpointSaver;

  /**
   * IoT SDK and cache configuration for the IoT Domain agent.
   *
   * Must be provided for the agent to make real device API calls.
   * When omitted (e.g. in unit tests where `createIoTDomainNode` is mocked),
   * a type-safe null-stub is used internally — callers are responsible for
   * ensuring the IoT tools are replaced via the mock layer before any tool
   * invocation occurs.
   */
  toolConfig?: ToolConfig;

  /**
   * Whether to enable verbose logging for debugging.
   * @default false
   */
  debug?: boolean;
}

/**
 * LangGraph 0.0.12 channel definition for an `AEPAgentState` field.
 *
 * `value` is the reducer: a `BinaryOperator<T>` that merges the previous
 * state value with the new value returned by a node.  When set to `null`
 * the channel uses the "last-write-wins" built-in.
 *
 * `default` provides the initial value.
 */
type ChannelDef<T> = {
  value: ((a: T, b: T) => T) | null;
  default?: () => T;
};

/**
 * Channel map that matches every field of `AEPAgentState`.
 *
 * This is the typed equivalent of what was previously expressed using the
 * `Annotation.Root` API (available in LangGraph >=0.2.x).  LangGraph 0.0.12
 * requires us to supply the channels map directly.
 */
const stateChannels: { [K in keyof AEPAgentState]: ChannelDef<AEPAgentState[K]> } = {
  messages: {
    value: (left: BaseMessage[], right: BaseMessage[]) => left.concat(right),
    default: () => [],
  },
  currentAgent: {
    // Take the new value; fall back to existing if the node returns undefined.
    value: (_left: AgentRole, right: AgentRole) => right ?? _left,
    default: () => AgentRole.SUPERVISOR,
  },
  projectId: {
    value: (left: string, right: string) => right || left,
    default: () => '',
  },
  tenantId: {
    value: (left: string, right: string) => right || left,
    default: () => '',
  },
  buildPlan: {
    value: (left: BuildTask[], right: BuildTask[]) =>
      right && right.length > 0 ? right : left,
    default: () => [],
  },
  completedTasks: {
    value: (left: BuildTask[], right: BuildTask[]) => left.concat(right),
    default: () => [],
  },
  generatedAssets: {
    value: (left: GeneratedAsset[], right: GeneratedAsset[]) => left.concat(right),
    default: () => [],
  },
  errors: {
    value: (left: AgentError[], right: AgentError[]) => left.concat(right),
    default: () => [],
  },
  approvals: {
    value: (left: ApprovalRequest[], right: ApprovalRequest[]) => left.concat(right),
    default: () => [],
  },
};

/**
 * Extract the supervisor decision from the last message in state.
 *
 * The supervisor node appends an `AIMessage` whose `additional_kwargs` field
 * contains `supervisor_decision: SupervisorOutput`.
 */
function extractSupervisorDecision(
  state: AEPAgentState
): SupervisorOutput | null {
  if (!state.messages || state.messages.length === 0) {
    return null;
  }

  const lastMessage = state.messages[state.messages.length - 1];

  // Primary path: check additional_kwargs
  if (
    lastMessage._getType() === 'ai' &&
    lastMessage.additional_kwargs != null &&
    'supervisor_decision' in lastMessage.additional_kwargs
  ) {
    return lastMessage.additional_kwargs['supervisor_decision'] as SupervisorOutput;
  }

  // Fallback: try to parse JSON content
  try {
    const content =
      typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    const parsed = JSON.parse(content) as Partial<SupervisorOutput>;
    if (parsed.next) {
      return parsed as SupervisorOutput;
    }
  } catch {
    // Not JSON or not a supervisor decision — continue to return null
  }

  return null;
}

/**
 * Conditional routing function executed after the `supervisor` node.
 *
 * Returns the name of the next node (`'planning'`, `'iot_domain'`) or the
 * built-in `END` sentinel when the supervisor signals completion.
 */
function routeFromSupervisor(
  state: AEPAgentState
): string {
  const decision = extractSupervisorDecision(state);

  if (!decision) {
    // Fall back to `currentAgent` if no decision message is found
    if (state.currentAgent === AgentRole.PLANNING) {
      return 'planning';
    } else if (state.currentAgent === AgentRole.IOT_DOMAIN) {
      return 'iot_domain';
    }
    console.warn('[Graph] No supervisor decision found, routing to END');
    return END;
  }

  switch (decision.next) {
    case 'planning':
      return 'planning';
    case 'iot_domain':
      return 'iot_domain';
    case 'FINISH':
      return END;
    default: {
      console.warn(
        `[Graph] Unknown supervisor decision: ${String(decision.next)}, routing to END`
      );
      return END;
    }
  }
}

/**
 * Creates and compiles the agent graph workflow.
 *
 * Graph structure:
 * ```
 *   START
 *     ↓
 * supervisor (routing hub)
 *     ├→ planning → supervisor
 *     ├→ iot_domain → supervisor
 *     └→ END  (when next === 'FINISH')
 * ```
 *
 * @param config - Optional graph configuration
 * @returns Compiled Pregel graph ready for invocation
 */
/**
 * Null-stub ToolConfig used when `toolConfig` is omitted from `GraphConfig`.
 * This satisfies the TypeScript type but will throw at runtime if any tool
 * method is actually invoked.  Use this only in contexts where
 * `createIoTDomainNode` is replaced by a mock (unit tests).
 */
const NULL_TOOL_CONFIG: ToolConfig = {
  sdk: {
    getDeviceList: () => { throw new Error('IoT SDK not configured'); },
    getDeviceById: () => { throw new Error('IoT SDK not configured'); },
    getDeviceTelemetry: () => { throw new Error('IoT SDK not configured'); },
    subscribeToEvents: () => { throw new Error('IoT SDK not configured'); },
    getFleetKpis: () => { throw new Error('IoT SDK not configured'); },
  },
  redis: undefined,
};

export function createAgentGraph(config: GraphConfig = { toolConfig: NULL_TOOL_CONFIG }) {
  const debug = config.debug ?? false;

  if (debug) {
    console.log('[Graph] Creating agent graph with config:', config);
  }

  // Initialise the StateGraph with the typed channels map
  const workflow = new StateGraph<AEPAgentState>({
    channels: stateChannels,
  });

  // Register agent nodes
  workflow.addNode('supervisor', createSupervisorNode());
  workflow.addNode('planning', createPlanningNode());
  workflow.addNode('iot_domain', createIoTDomainNode(config.toolConfig ?? NULL_TOOL_CONFIG));

  if (debug) {
    console.log('[Graph] Agent nodes added: supervisor, planning, iot_domain');
  }

  // Entry edge
  workflow.addEdge(START, 'supervisor');

  // Specialist agents return to supervisor
  workflow.addEdge('planning', 'supervisor');
  workflow.addEdge('iot_domain', 'supervisor');

  // Conditional routing from supervisor
  workflow.addConditionalEdges('supervisor', routeFromSupervisor, {
    planning: 'planning',
    iot_domain: 'iot_domain',
    [END]: END,
  });

  if (debug) {
    console.log('[Graph] Graph structure:');
    console.log('  START → supervisor');
    console.log('  supervisor → [conditional] → planning | iot_domain | END');
    console.log('  planning → supervisor');
    console.log('  iot_domain → supervisor');
  }

  const compiledGraph = workflow.compile(config?.checkpointer);

  if (debug) {
    console.log('[Graph] Graph compiled successfully');
  }

  return compiledGraph;
}

/**
 * Type alias for the compiled graph.
 */
export type CompiledGraph = ReturnType<typeof createAgentGraph>;
