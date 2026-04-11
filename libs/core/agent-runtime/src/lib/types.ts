import type { BaseMessage } from '@langchain/core/messages';

/**
 * Agent roles in the multi-agent system (Phase 1: 3 agents)
 */
export enum AgentRole {
  SUPERVISOR = 'supervisor',
  PLANNING = 'planning',
  IOT_DOMAIN = 'iot_domain',
}

/**
 * Status of a build task
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * A single task in the build plan
 */
export interface BuildTask {
  id: string;
  type: string;
  description: string;
  agent: AgentRole;
  dependencies: string[];
  status: TaskStatus;
}

/**
 * An asset generated during the build process
 */
export interface GeneratedAsset {
  id: string;
  type: string;
  path: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * An error that occurred during agent execution
 */
export interface AgentError {
  agent: AgentRole;
  message: string;
  timestamp: Date;
  recoverable: boolean;
}

/**
 * Status of an approval request
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

/**
 * A request for user approval
 */
export interface ApprovalRequest {
  id: string;
  type: string;
  description: string;
  status: ApprovalStatus;
  requestedAt: Date;
}

/**
 * The shared state for the multi-agent system
 */
export interface AEPAgentState {
  /** Message history for the conversation */
  messages: BaseMessage[];
  /** Currently active agent */
  currentAgent: AgentRole;
  /** Project identifier */
  projectId: string;
  /** Tenant identifier for multi-tenancy */
  tenantId: string;
  /** Planned build tasks */
  buildPlan: BuildTask[];
  /** Completed build tasks */
  completedTasks: BuildTask[];
  /** Assets generated during the build */
  generatedAssets: GeneratedAsset[];
  /** Errors encountered during execution */
  errors: AgentError[];
  /** Approval requests requiring user confirmation */
  approvals: ApprovalRequest[];
}

/**
 * Output from the supervisor agent
 */
export interface SupervisorOutput {
  /** Next agent to execute, or FINISH to complete */
  next: 'planning' | 'iot_domain' | 'FINISH';
  /** Optional reasoning for the routing decision */
  reasoning?: string;
}

/**
 * Configuration for an agent
 */
export interface AgentConfig {
  /** LLM provider name (e.g., 'openai', 'anthropic', 'ollama') */
  llmProvider: string;
  /** Model name (e.g., 'gpt-4', 'claude-3-opus') */
  llmModel: string;
  /** Temperature for response generation */
  temperature: number;
  /** Maximum tokens for response (optional) */
  maxTokens?: number;
}
