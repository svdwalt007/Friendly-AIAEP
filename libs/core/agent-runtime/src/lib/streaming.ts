/**
 * Agent Streaming Interface
 *
 * Provides real-time streaming capabilities for agent execution.
 * Supports WebSocket transmission with JSON-serializable chunks.
 */

import type { AEPAgentState } from './types';
import { AgentRole } from './types';

/**
 * Configuration for streaming agent responses
 */
export interface StreamConfig {
  /** Thread ID for conversation tracking */
  thread_id: string;
  /** Optional checkpoint ID for resuming from a specific state */
  checkpoint_id?: string;
  /** Optional configuration overrides */
  configurable?: Record<string, unknown>;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Base structure for all stream chunks
 */
interface BaseStreamChunk {
  /** Chunk type identifier */
  type: StreamChunkType;
  /** ISO timestamp when chunk was created */
  timestamp: string;
  /** Thread ID for tracking */
  thread_id: string;
}

/**
 * Types of chunks that can be streamed
 */
export type StreamChunkType =
  | 'message'
  | 'state'
  | 'error'
  | 'completion'
  | 'agent_thinking'
  | 'agent_tool_call'
  | 'agent_response'
  | 'build_progress'
  | 'task_update';

/**
 * Message chunk - Agent message content (may be partial for streaming)
 */
export interface MessageChunk extends BaseStreamChunk {
  type: 'message';
  /** The agent producing this message */
  agent: AgentRole;
  /** Message content (may be partial/incremental) */
  content: string;
  /** Whether this is the final chunk for this message */
  done: boolean;
}

/**
 * State update chunk - Build plan or task status changes
 */
export interface StateUpdateChunk extends BaseStreamChunk {
  type: 'state';
  /** The agent that triggered this state update */
  agent: AgentRole;
  /** Type of state update */
  updateType: 'build_plan' | 'task_completed' | 'task_started' | 'approval_requested';
  /** The updated data */
  data: unknown;
}

/**
 * Agent thinking chunk - Indicates agent is processing
 */
export interface AgentThinkingChunk extends BaseStreamChunk {
  type: 'agent_thinking';
  /** The agent that is thinking */
  agent: AgentRole;
  /** Optional message about what the agent is doing */
  message?: string;
}

/**
 * Agent tool call chunk - Agent is invoking a tool
 */
export interface AgentToolCallChunk extends BaseStreamChunk {
  type: 'agent_tool_call';
  /** The agent making the tool call */
  agent: AgentRole;
  /** Name of the tool being called */
  toolName: string;
  /** Tool call arguments */
  args: Record<string, unknown>;
}

/**
 * Agent response chunk - Agent's text response (streaming)
 */
export interface AgentResponseChunk extends BaseStreamChunk {
  type: 'agent_response';
  /** The agent producing the response */
  agent: AgentRole;
  /** Response content (may be partial) */
  content: string;
  /** Whether this is the final chunk */
  done: boolean;
}

/**
 * Build progress chunk - Build/codegen progress updates
 */
export interface BuildProgressChunk extends BaseStreamChunk {
  type: 'build_progress';
  /** Task ID being worked on */
  taskId: string;
  /** Progress percentage (0-100) */
  progress: number;
  /** Progress message */
  message: string;
}

/**
 * Task update chunk - Task status changes
 */
export interface TaskUpdateChunk extends BaseStreamChunk {
  type: 'task_update';
  /** Task ID */
  taskId: string;
  /** New task status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  /** Optional message */
  message?: string;
}

/**
 * Error chunk - Error events
 */
export interface ErrorChunk extends BaseStreamChunk {
  type: 'error';
  /** The agent where the error occurred */
  agent: AgentRole;
  /** Error message */
  message: string;
  /** Error code for categorization */
  code?: string;
  /** Whether the error is recoverable */
  recoverable: boolean;
  /** Stack trace (only in debug mode) */
  stack?: string;
}

/**
 * Completion chunk - Final completion event
 */
export interface CompletionChunk extends BaseStreamChunk {
  type: 'completion';
  /** The final agent state */
  finalState: Partial<AEPAgentState>;
  /** Summary of the execution */
  summary?: string;
}

/**
 * Union type of all possible stream chunks
 */
export type StreamChunk =
  | MessageChunk
  | StateUpdateChunk
  | AgentThinkingChunk
  | AgentToolCallChunk
  | AgentResponseChunk
  | BuildProgressChunk
  | TaskUpdateChunk
  | ErrorChunk
  | CompletionChunk;

/**
 * Compiled graph interface (placeholder for LangGraph CompiledGraph)
 * This will be replaced with actual LangGraph types when integrated
 */
export interface CompiledGraph {
  stream(
    input: Partial<AEPAgentState>,
    config?: StreamConfig
  ): AsyncIterableIterator<[string, Partial<AEPAgentState>]>;
  invoke(
    input: Partial<AEPAgentState>,
    config?: StreamConfig
  ): Promise<AEPAgentState>;
}

/**
 * Logger utility for streaming
 */
function logDebug(config: StreamConfig, message: string, data?: unknown): void {
  if (config.debug) {
    console.log(`[AgentStream] ${message}`, data || '');
  }
}

function logError(message: string, error?: unknown): void {
  console.error(`[AgentStream Error] ${message}`, error || '');
}

/**
 * Create a base chunk with common fields
 */
function createBaseChunk<T extends StreamChunkType>(
  type: T,
  threadId: string
): BaseStreamChunk & { type: T } {
  return {
    type,
    timestamp: new Date().toISOString(),
    thread_id: threadId,
  };
}

/**
 * AgentStream class that wraps a compiled graph
 *
 * Provides high-level streaming interface with lifecycle management.
 */
export class AgentStream {
  private graph: CompiledGraph;
  private config: StreamConfig;
  private abortController: AbortController;
  private isRunning = false;

  constructor(graph: CompiledGraph, config: StreamConfig) {
    this.graph = graph;
    this.config = config;
    this.abortController = new AbortController();
  }

  /**
   * Stream agent execution with real-time updates
   *
   * @param initialState - Initial agent state
   * @returns AsyncGenerator yielding stream chunks
   */
  async *stream(
    initialState: Partial<AEPAgentState>
  ): AsyncGenerator<StreamChunk> {
    if (this.isRunning) {
      throw new Error('Stream is already running');
    }

    this.isRunning = true;
    logDebug(this.config, 'Starting agent stream', { threadId: this.config.thread_id });

    try {
      yield* streamAgentResponse(this.graph, initialState, this.config);
    } catch (error) {
      logError('Stream execution failed', error);

      // Yield error chunk
      const errorChunk: ErrorChunk = {
        ...createBaseChunk('error', this.config.thread_id),
        agent: initialState.currentAgent || AgentRole.SUPERVISOR,
        message: error instanceof Error ? error.message : String(error),
        code: 'STREAM_ERROR',
        recoverable: false,
        stack: this.config.debug && error instanceof Error ? error.stack : undefined,
      };
      yield errorChunk;
    } finally {
      this.isRunning = false;
      logDebug(this.config, 'Agent stream completed');
    }
  }

  /**
   * Cancel the running stream
   */
  cancel(): void {
    if (this.isRunning) {
      logDebug(this.config, 'Cancelling agent stream');
      this.abortController.abort();
    }
  }

  /**
   * Check if stream is currently running
   */
  get running(): boolean {
    return this.isRunning;
  }
}

/**
 * Stream agent response from a compiled graph
 *
 * This is the core streaming function that yields chunks as the agent executes.
 * It monitors graph execution and converts state changes into stream chunks.
 *
 * @param graph - The compiled LangGraph graph
 * @param initialState - Initial state to start execution from
 * @param config - Stream configuration
 * @returns AsyncGenerator yielding StreamChunk objects
 *
 * @example
 * ```typescript
 * import { streamAgentResponse } from '@friendly-tech/core/agent-runtime';
 * import { HumanMessage } from '@langchain/core/messages';
 *
 * const state = {
 *   messages: [new HumanMessage('Build a fleet dashboard')],
 *   currentAgent: 'supervisor',
 *   projectId: 'proj-123',
 *   tenantId: 'tenant-456',
 *   buildPlan: [],
 *   completedTasks: [],
 *   generatedAssets: [],
 *   errors: [],
 *   approvals: [],
 * };
 *
 * const config = {
 *   thread_id: 'thread-abc',
 *   debug: true,
 * };
 *
 * for await (const chunk of streamAgentResponse(graph, state, config)) {
 *   console.log(`[${chunk.type}]`, chunk);
 *
 *   // Send to WebSocket
 *   websocket.send(JSON.stringify(chunk));
 * }
 * ```
 */
export async function* streamAgentResponse(
  graph: CompiledGraph,
  initialState: Partial<AEPAgentState>,
  config: StreamConfig
): AsyncGenerator<StreamChunk> {
  logDebug(config, 'Initializing agent stream', {
    threadId: config.thread_id,
    checkpointId: config.checkpoint_id,
  });

  let previousState: Partial<AEPAgentState> = { ...initialState };
  let currentAgent: AgentRole = initialState.currentAgent || AgentRole.SUPERVISOR;
  const startTime = Date.now();

  try {
    // Stream graph execution
    // LangGraph stream() returns an async iterator of [nodeName, state] tuples
    for await (const [nodeName, state] of graph.stream(initialState, config)) {
      logDebug(config, `Node executed: ${nodeName}`, {
        currentAgent: state.currentAgent,
      });

      // Track agent changes
      if (state.currentAgent && state.currentAgent !== currentAgent) {
        const prevAgent = currentAgent;
        currentAgent = state.currentAgent;

        logDebug(config, `Agent transition: ${prevAgent} -> ${currentAgent}`);

        // Yield agent thinking chunk when switching agents
        const thinkingChunk: AgentThinkingChunk = {
          ...createBaseChunk('agent_thinking', config.thread_id),
          agent: currentAgent,
          message: `Agent ${currentAgent} is processing...`,
        };
        yield thinkingChunk;
      }

      // Detect new messages
      if (state.messages && previousState.messages) {
        const newMessages = state.messages.slice(previousState.messages.length);

        for (const message of newMessages) {
          const content = typeof message.content === 'string'
            ? message.content
            : JSON.stringify(message.content);

          // Check if this is an AI message (agent response)
          if (message._getType() === 'ai') {
            const responseChunk: AgentResponseChunk = {
              ...createBaseChunk('agent_response', config.thread_id),
              agent: currentAgent,
              content,
              done: true,
            };
            yield responseChunk;
          } else {
            // Other message types (human, system, etc.)
            const messageChunk: MessageChunk = {
              ...createBaseChunk('message', config.thread_id),
              agent: currentAgent,
              content,
              done: true,
            };
            yield messageChunk;
          }
        }
      }

      // Detect build plan changes
      if (state.buildPlan && JSON.stringify(state.buildPlan) !== JSON.stringify(previousState.buildPlan)) {
        logDebug(config, 'Build plan updated', {
          taskCount: state.buildPlan.length,
        });

        const stateChunk: StateUpdateChunk = {
          ...createBaseChunk('state', config.thread_id),
          agent: currentAgent,
          updateType: 'build_plan',
          data: {
            buildPlan: state.buildPlan,
            totalTasks: state.buildPlan.length,
          },
        };
        yield stateChunk;
      }

      // Detect task completions
      if (state.completedTasks && previousState.completedTasks) {
        const newCompletions = state.completedTasks.slice(previousState.completedTasks.length);

        for (const task of newCompletions) {
          logDebug(config, `Task completed: ${task.id}`, {
            description: task.description,
          });

          const taskChunk: TaskUpdateChunk = {
            ...createBaseChunk('task_update', config.thread_id),
            taskId: task.id,
            status: 'completed',
            message: task.description,
          };
          yield taskChunk;

          const stateChunk: StateUpdateChunk = {
            ...createBaseChunk('state', config.thread_id),
            agent: currentAgent,
            updateType: 'task_completed',
            data: task,
          };
          yield stateChunk;
        }
      }

      // Detect task status changes (in progress)
      if (state.buildPlan && previousState.buildPlan) {
        for (let i = 0; i < state.buildPlan.length; i++) {
          const currentTask = state.buildPlan[i];
          const previousTask = previousState.buildPlan?.[i];

          if (previousTask && currentTask.status !== previousTask.status) {
            if (currentTask.status === 'in_progress') {
              logDebug(config, `Task started: ${currentTask.id}`);

              const taskChunk: TaskUpdateChunk = {
                ...createBaseChunk('task_update', config.thread_id),
                taskId: currentTask.id,
                status: 'in_progress',
                message: currentTask.description,
              };
              yield taskChunk;

              const stateChunk: StateUpdateChunk = {
                ...createBaseChunk('state', config.thread_id),
                agent: currentAgent,
                updateType: 'task_started',
                data: currentTask,
              };
              yield stateChunk;
            }
          }
        }
      }

      // Detect approval requests
      if (state.approvals && previousState.approvals) {
        const newApprovals = state.approvals.filter(
          approval => !previousState.approvals?.some(prev => prev.id === approval.id)
        );

        for (const approval of newApprovals) {
          if (approval.status === 'pending') {
            logDebug(config, `Approval requested: ${approval.type}`);

            const stateChunk: StateUpdateChunk = {
              ...createBaseChunk('state', config.thread_id),
              agent: currentAgent,
              updateType: 'approval_requested',
              data: approval,
            };
            yield stateChunk;
          }
        }
      }

      // Detect errors
      if (state.errors && previousState.errors) {
        const newErrors = state.errors.slice(previousState.errors.length);

        for (const error of newErrors) {
          logError(`Agent error from ${error.agent}: ${error.message}`);

          const errorChunk: ErrorChunk = {
            ...createBaseChunk('error', config.thread_id),
            agent: error.agent,
            message: error.message,
            code: 'AGENT_ERROR',
            recoverable: error.recoverable,
          };
          yield errorChunk;
        }
      }

      // Update previous state for next iteration
      previousState = { ...state };
    }

    // Execution completed successfully
    const duration = Date.now() - startTime;
    logDebug(config, `Stream completed successfully in ${duration}ms`);

    const completionChunk: CompletionChunk = {
      ...createBaseChunk('completion', config.thread_id),
      finalState: previousState,
      summary: `Agent execution completed in ${duration}ms`,
    };
    yield completionChunk;

  } catch (error) {
    logError('Stream execution error', error);

    // Yield error chunk for any uncaught errors
    const errorChunk: ErrorChunk = {
      ...createBaseChunk('error', config.thread_id),
      agent: currentAgent,
      message: error instanceof Error ? error.message : String(error),
      code: 'EXECUTION_ERROR',
      recoverable: false,
      stack: config.debug && error instanceof Error ? error.stack : undefined,
    };
    yield errorChunk;

    throw error;
  }
}

/**
 * Helper function to send stream chunks to WebSocket
 *
 * @param chunk - The chunk to send
 * @param connection - WebSocket connection
 *
 * @example
 * ```typescript
 * for await (const chunk of streamAgentResponse(graph, state, config)) {
 *   sendChunkToWebSocket(chunk, websocketConnection);
 * }
 * ```
 */
export function sendChunkToWebSocket(
  chunk: StreamChunk,
  connection: { send: (data: string) => void }
): void {
  try {
    connection.send(JSON.stringify(chunk));
  } catch (error) {
    logError('Failed to send chunk to WebSocket', error);
  }
}

/**
 * Helper to create a mock CompiledGraph for testing
 * This should only be used in tests
 */
export function createMockGraph(
  streamHandler: (
    input: Partial<AEPAgentState>,
    config?: StreamConfig
  ) => AsyncIterableIterator<[string, Partial<AEPAgentState>]>
): CompiledGraph {
  return {
    stream: streamHandler,
    invoke: async (input) => input as AEPAgentState,
  };
}
