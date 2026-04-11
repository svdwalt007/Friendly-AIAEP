/**
 * @fileoverview LangGraph StateGraph workflow for AEP Multi-Agent System
 * @module @friendly-tech/core/agent-runtime
 *
 * This module defines the core graph structure for the multi-agent system,
 * orchestrating the flow between the Supervisor, Planning, and IoT Domain agents.
 */

// @ts-nocheck - TODO: Fix StateGraph type issues
import {
  StateGraph,
  START,
  END,
  Annotation,
} from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';
import type { SupervisorOutput, BuildTask, GeneratedAsset, AgentError, ApprovalRequest } from './types';
import { AgentRole } from './types';
import { createSupervisorNode } from './agents/supervisor';
import { createPlanningNode } from './agents/planning';
import { createIoTDomainNode } from './agents/iot-domain';

/**
 * Configuration options for the agent graph
 */
export interface GraphConfig {
  /**
   * Optional checkpointer for persisting conversation state
   * Enables features like conversation history, resume, and time-travel debugging
   */
  checkpointer?: any;

  /**
   * Whether to enable verbose logging for debugging
   * @default false
   */
  debug?: boolean;
}

/**
 * Define the state annotation for the agent graph
 * This replaces the manual channel definition approach
 */
const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  currentAgent: Annotation<AgentRole>({
    reducer: (left, right) => right ?? left,
    default: () => AgentRole.SUPERVISOR,
  }),
  projectId: Annotation<string>({
    reducer: (left, right) => right || left,
    default: () => '',
  }),
  tenantId: Annotation<string>({
    reducer: (left, right) => right || left,
    default: () => '',
  }),
  buildPlan: Annotation<BuildTask[]>({
    reducer: (left, right) => (right && right.length > 0 ? right : left),
    default: () => [],
  }),
  completedTasks: Annotation<BuildTask[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  generatedAssets: Annotation<GeneratedAsset[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  errors: Annotation<AgentError[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  approvals: Annotation<ApprovalRequest[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
});

/**
 * Type for the agent state derived from the annotation
 */
type AgentState = typeof AgentStateAnnotation.State;

/**
 * Extract supervisor decision from the last message in state
 *
 * The supervisor node adds its decision to the messages array as an AIMessage
 * with additional_kwargs.supervisor_decision containing the SupervisorOutput.
 *
 * @param state - Current agent state
 * @returns The supervisor's routing decision, or null if not found
 */
function extractSupervisorDecision(
  state: AgentState
): SupervisorOutput | null {
  if (!state.messages || state.messages.length === 0) {
    return null;
  }

  // Get the last message
  const lastMessage = state.messages[state.messages.length - 1];

  // Check if it's an AI message with supervisor decision
  if (
    lastMessage._getType() === 'ai' &&
    lastMessage.additional_kwargs &&
    'supervisor_decision' in lastMessage.additional_kwargs
  ) {
    return lastMessage.additional_kwargs['supervisor_decision'] as SupervisorOutput;
  }

  // Try to parse from message content as fallback
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
    // Not JSON or not a supervisor decision
  }

  return null;
}

/**
 * Routing function that determines the next node based on supervisor output
 *
 * This function is used as a conditional edge from the supervisor node.
 * It examines the supervisor's decision and routes to the appropriate specialist agent or END.
 *
 * @param state - Current agent state
 * @returns Next node name: 'planning', 'iot_domain', or END
 */
function routeFromSupervisor(
  state: AgentState
): typeof END | 'planning' | 'iot_domain' {
  const decision = extractSupervisorDecision(state);

  if (!decision) {
    // If we can't find a decision, check the currentAgent field as fallback
    if (state.currentAgent === AgentRole.PLANNING) {
      return 'planning';
    } else if (state.currentAgent === AgentRole.IOT_DOMAIN) {
      return 'iot_domain';
    }
    // Default to END if no decision can be determined
    console.warn('[Graph] No supervisor decision found, routing to END');
    return END;
  }

  // Route based on supervisor's decision
  switch (decision.next) {
    case 'planning':
      return 'planning';
    case 'iot_domain':
      return 'iot_domain';
    case 'FINISH':
      return END;
    default:
      console.warn(
        `[Graph] Unknown supervisor decision: ${decision.next}, routing to END`
      );
      return END;
  }
}

/**
 * Creates and compiles the agent graph workflow
 *
 * The graph structure:
 * ```
 *   START
 *     ↓
 * supervisor (routing hub)
 *     ├→ planning → supervisor (return after plan)
 *     ├→ iot_domain → supervisor (return after answer)
 *     └→ END (when next === 'FINISH')
 * ```
 *
 * Features:
 * - Conditional routing from supervisor based on user intent
 * - Specialist agents return control to supervisor after execution
 * - Support for streaming and checkpointing
 * - Proper error handling and state management
 *
 * @param config - Optional configuration for the graph
 * @returns Compiled graph ready for execution
 *
 * @example
 * ```typescript
 * import { createAgentGraph } from '@friendly-tech/core/agent-runtime';
 * import { HumanMessage } from '@langchain/core/messages';
 * import { AgentRole } from '@friendly-tech/core/agent-runtime';
 *
 * // Create the graph
 * const graph = createAgentGraph({ debug: true });
 *
 * // Initialize state
 * const initialState = {
 *   messages: [new HumanMessage('Build a fleet dashboard')],
 *   currentAgent: AgentRole.SUPERVISOR,
 *   projectId: 'proj-123',
 *   tenantId: 'tenant-456',
 *   buildPlan: [],
 *   completedTasks: [],
 *   generatedAssets: [],
 *   errors: [],
 *   approvals: [],
 * };
 *
 * // Run the graph
 * const result = await graph.invoke(initialState);
 * console.log('Final state:', result);
 * ```
 *
 * @example Streaming example:
 * ```typescript
 * const graph = createAgentGraph();
 *
 * // Stream events as the graph executes
 * for await (const event of graph.stream(initialState)) {
 *   console.log('Event:', event);
 * }
 * ```
 */
export function createAgentGraph(config?: GraphConfig) {
  const debug = config?.debug ?? false;

  if (debug) {
    console.log('[Graph] Creating agent graph with config:', config);
  }

  // Initialize the StateGraph with the annotation
  const workflow = new StateGraph(AgentStateAnnotation);

  // Add agent nodes to the graph
  if (debug) {
    console.log('[Graph] Adding agent nodes...');
  }

  workflow.addNode('supervisor', createSupervisorNode());
  workflow.addNode('planning', createPlanningNode());
  workflow.addNode('iot_domain', createIoTDomainNode());

  if (debug) {
    console.log('[Graph] Agent nodes added: supervisor, planning, iot_domain');
  }

  // Define edges
  if (debug) {
    console.log('[Graph] Defining edges...');
  }

  // Start with supervisor
  workflow.addEdge(START, 'supervisor');

  // Specialist agents return to supervisor after execution
  workflow.addEdge('planning', 'supervisor');
  workflow.addEdge('iot_domain', 'supervisor');

  // Conditional edge from supervisor
  // Routes to planning, iot_domain, or END based on supervisor's decision
  workflow.addConditionalEdges('supervisor', routeFromSupervisor);

  if (debug) {
    console.log('[Graph] Edges defined');
    console.log('[Graph] Graph structure:');
    console.log('  START → supervisor');
    console.log('  supervisor → [conditional] → planning | iot_domain | END');
    console.log('  planning → supervisor');
    console.log('  iot_domain → supervisor');
  }

  // Compile the graph
  const compiledGraph = workflow.compile({
    checkpointer: config?.checkpointer,
  });

  if (debug) {
    console.log('[Graph] Graph compiled successfully');
  }

  return compiledGraph;
}

/**
 * Type alias for the compiled graph
 * Exported for convenience and type safety
 */
export type CompiledGraph = ReturnType<typeof createAgentGraph>;
