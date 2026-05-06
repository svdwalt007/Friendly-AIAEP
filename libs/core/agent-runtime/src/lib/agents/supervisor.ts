/**
 * Supervisor Agent Implementation
 *
 * The supervisor agent routes user requests to appropriate specialist agents.
 * It uses Claude Opus 4.6 to analyze messages and determine the next agent to execute.
 */

// @ts-nocheck - TODO: Fix type issues with LLMProvider
import type { BaseMessage } from '@langchain/core/messages';
import { AIMessage } from '@langchain/core/messages';
import type { AEPAgentState, SupervisorOutput } from '../types';
import { AgentRole } from '../types';
import { getProvider, AgentRole as LLMAgentRole } from '@friendly-tech/core/llm-providers';
import type { LLMProviderInterface } from '@friendly-tech/core/llm-providers';
import { SUPERVISOR_PROMPT } from '../constants';

/**
 * Logger utility for supervisor agent
 */
function logError(message: string, error?: unknown): void {
  console.error(`[Supervisor Agent] ${message}`, error || '');
}

function logInfo(message: string): void {
  console.log(`[Supervisor Agent] ${message}`);
}

/**
 * Parse the supervisor's output from LLM response
 *
 * @param content - The content from the LLM response
 * @returns Parsed SupervisorOutput
 * @throws Error if parsing fails or output is invalid
 */
function parseSupervisorOutput(content: string): SupervisorOutput {
  try {
    // Try to extract JSON from the response
    // The LLM might wrap it in markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || content.match(/(\{[\s\S]*\})/);

    if (!jsonMatch) {
      throw new Error('No JSON object found in response');
    }

    const parsed = JSON.parse(jsonMatch[1]) as Partial<SupervisorOutput>;

    // Validate the output
    if (!parsed.next) {
      throw new Error('Missing "next" field in supervisor output');
    }

    // Validate next value
    const validNextValues = ['planning', 'iot_domain', 'FINISH'] as const;
    if (!validNextValues.includes(parsed.next as any)) {
      throw new Error(`Invalid "next" value: ${parsed.next}. Must be one of: ${validNextValues.join(', ')}`);
    }

    return {
      next: parsed.next as 'planning' | 'iot_domain' | 'FINISH',
      reasoning: parsed.reasoning,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse supervisor output: ${error.message}\nContent: ${content}`);
    }
    throw error;
  }
}

/**
 * Convert LangChain BaseMessage to a simple string representation
 *
 * @param message - The message to convert
 * @returns String representation of the message
 */
function messageToString(message: BaseMessage): string {
  const role = message._getType();
  const content = typeof message.content === 'string'
    ? message.content
    : JSON.stringify(message.content);

  return `${role}: ${content}`;
}

/**
 * Build the context summary for the supervisor
 *
 * @param state - Current agent state
 * @returns Context summary string
 */
function buildContextSummary(state: AEPAgentState): string {
  const parts: string[] = [];

  // Add project info
  parts.push(`Project ID: ${state.projectId}`);
  parts.push(`Tenant ID: ${state.tenantId}`);

  // Add current agent if available
  if (state.currentAgent) {
    parts.push(`Current Agent: ${state.currentAgent}`);
  }

  // Add build plan summary
  if (state.buildPlan && state.buildPlan.length > 0) {
    parts.push(`\nBuild Plan: ${state.buildPlan.length} tasks defined`);
  }

  // Add completed tasks summary
  if (state.completedTasks && state.completedTasks.length > 0) {
    parts.push(`Completed Tasks: ${state.completedTasks.length}`);
  }

  // Add errors if any
  if (state.errors && state.errors.length > 0) {
    parts.push(`\nErrors: ${state.errors.length} errors encountered`);
  }

  // Add approvals if pending
  if (state.approvals && state.approvals.length > 0) {
    const pending = state.approvals.filter(a => a.status === 'pending').length;
    if (pending > 0) {
      parts.push(`Pending Approvals: ${pending}`);
    }
  }

  return parts.join('\n');
}

/**
 * Create the supervisor node function
 *
 * The supervisor analyzes the conversation and routes to the appropriate specialist agent.
 *
 * @returns Async function that processes state and returns updated state
 *
 * @example
 * ```typescript
 * const supervisorNode = createSupervisorNode();
 * const updatedState = await supervisorNode(currentState);
 * console.log(`Next agent: ${updatedState.currentAgent}`);
 * ```
 */
export function createSupervisorNode(): (state: AEPAgentState) => Promise<Partial<AEPAgentState>> {
  return async (state: AEPAgentState): Promise<Partial<AEPAgentState>> => {
    logInfo('Supervisor agent processing request');

    try {
      // Get the LLM provider for the supervisor role
      let provider: LLMProviderInterface;
      try {
        provider = getProvider(LLMAgentRole.SUPERVISOR);
        logInfo(`Using provider: ${provider.type}`);
      } catch (error) {
        logError('Failed to get LLM provider', error);
        throw new Error(`Supervisor agent failed to initialize LLM provider: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Get the last message from the conversation
      if (!state.messages || state.messages.length === 0) {
        throw new Error('No messages in state to analyze');
      }

      const lastMessage = state.messages[state.messages.length - 1];
      logInfo(`Analyzing message: ${messageToString(lastMessage).substring(0, 100)}...`);

      // Build the context summary
      const contextSummary = buildContextSummary(state);

      // Format recent conversation history (last 5 messages)
      const recentMessages = state.messages.slice(-5);
      const conversationHistory = recentMessages.map(messageToString).join('\n\n');

      // Build the user message with context
      const userPrompt = `Context:
${contextSummary}

Recent Conversation:
${conversationHistory}

Based on the above conversation and context, determine which specialist agent should handle this request.`;

      // Call the LLM
      let response;
      try {
        response = await provider.complete({
          model: provider.config.defaultModel || 'claude-opus-4-6',
          messages: [
            { role: 'user', content: SUPERVISOR_PROMPT },
            { role: 'assistant', content: 'I understand. I will analyze user requests and route them to the appropriate specialist agent (planning, iot_domain, or FINISH). I will respond with a JSON object containing "next" and "reasoning" fields.' },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 1024,
          temperature: 0.7,
        });

        logInfo('Received response from LLM');
      } catch (error) {
        logError('LLM completion failed', error);
        throw new Error(`Supervisor agent LLM request failed: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Extract the text content from response
      let responseText = '';
      if (response.content && Array.isArray(response.content)) {
        const textBlock = response.content.find(block => block.type === 'text');
        if (textBlock && 'text' in textBlock) {
          responseText = textBlock.text;
        }
      }

      if (!responseText) {
        throw new Error('No text content in LLM response');
      }

      logInfo(`LLM response: ${responseText.substring(0, 200)}...`);

      // Parse the supervisor output
      let supervisorOutput: SupervisorOutput;
      try {
        supervisorOutput = parseSupervisorOutput(responseText);
        logInfo(`Routing decision: ${supervisorOutput.next} - ${supervisorOutput.reasoning || 'No reasoning provided'}`);
      } catch (error) {
        logError('Failed to parse supervisor output', error);

        // Fallback: If we can't parse the output, try to infer intent from the last message
        const lastMessageContent = typeof lastMessage.content === 'string'
          ? lastMessage.content.toLowerCase()
          : String(lastMessage.content).toLowerCase();

        // Simple keyword-based fallback routing
        if (lastMessageContent.includes('build') ||
            lastMessageContent.includes('create') ||
            lastMessageContent.includes('new app') ||
            lastMessageContent.includes('project')) {
          supervisorOutput = {
            next: 'planning',
            reasoning: 'Fallback routing: detected app building intent',
          };
          logInfo('Using fallback routing to planning agent');
        } else if (lastMessageContent.includes('device') ||
                   lastMessageContent.includes('telemetry') ||
                   lastMessageContent.includes('lwm2m') ||
                   lastMessageContent.includes('iot')) {
          supervisorOutput = {
            next: 'iot_domain',
            reasoning: 'Fallback routing: detected IoT domain query',
          };
          logInfo('Using fallback routing to iot_domain agent');
        } else {
          // If we really can't determine, default to planning for Phase 1
          supervisorOutput = {
            next: 'planning',
            reasoning: 'Fallback routing: unable to parse LLM output, defaulting to planning',
          };
          logInfo('Using fallback routing to planning agent (default)');
        }
      }

      // Map the routing decision to AgentRole
      let nextAgent: AgentRole;
      switch (supervisorOutput.next) {
        case 'planning':
          nextAgent = AgentRole.PLANNING;
          break;
        case 'iot_domain':
          nextAgent = AgentRole.IOT_DOMAIN;
          break;
        case 'FINISH':
          // For FINISH, we keep current agent but signal completion
          // The graph should handle this by routing to END node
          nextAgent = AgentRole.SUPERVISOR;
          break;
        default:
          throw new Error(`Unexpected routing decision: ${supervisorOutput.next}`);
      }

      // Create an AI message with the supervisor's decision
      const aiMessage = new AIMessage({
        content: JSON.stringify(supervisorOutput),
        additional_kwargs: {
          supervisor_decision: supervisorOutput,
        },
      });

      // Return the updated state
      return {
        currentAgent: nextAgent,
        messages: [...state.messages, aiMessage],
      };

    } catch (error) {
      logError('Supervisor agent encountered an error', error);

      // Add error to state
      const errorMessage = error instanceof Error ? error.message : String(error);
      const agentError = {
        agent: AgentRole.SUPERVISOR,
        message: errorMessage,
        timestamp: new Date(),
        recoverable: false,
      };

      return {
        currentAgent: AgentRole.SUPERVISOR,
        errors: [...(state.errors || []), agentError],
      };
    }
  };
}
