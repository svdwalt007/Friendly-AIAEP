/**
 * @fileoverview IoT Domain Agent - Handles IoT-specific queries and device operations
 * @module @friendly-tech/core/agent-runtime/agents
 */

// @ts-nocheck - TODO: Fix type issues with LLMProvider and StructuredToolInterface
import { AIMessage } from '@langchain/core/messages';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { getProvider } from '@friendly-tech/core/llm-providers';
import { AgentRole } from '@friendly-tech/core/llm-providers';
import {
  createGetDeviceListTool,
  createGetDeviceDetailsTool,
  createGetDeviceTelemetryTool,
  createRegisterWebhookTool,
  createGetKPIMetricsTool,
  type ToolConfig,
} from '@friendly-tech/iot/iot-tool-functions';
import type { AEPAgentState } from '../types';
import { IOT_DOMAIN_PROMPT } from '../constants';

/**
 * Creates the IoT Domain agent node for LangGraph
 *
 * This agent specializes in IoT-related queries and has access to all 5 IoT tool functions
 * for querying device data, telemetry, and KPI metrics from the Friendly One-IoT DM platform.
 *
 * @returns Agent node function that processes state and returns updated state
 *
 * @example
 * ```typescript
 * import { createIoTDomainNode } from './agents/iot-domain';
 *
 * const iotDomainNode = createIoTDomainNode();
 * const result = await iotDomainNode(state);
 * ```
 */
export function createIoTDomainNode(): (
  state: AEPAgentState
) => Promise<Partial<AEPAgentState>> {
  return async (state: AEPAgentState): Promise<Partial<AEPAgentState>> => {
    try {
      // Get the LLM provider for IoT Domain agent (Claude Opus 4.6)
      const provider = getProvider(AgentRole.IOT_DOMAIN);

      // Create tool configuration
      // NOTE: In production, these should come from the tenant configuration
      // For now, we'll use a placeholder configuration
      const toolConfig: ToolConfig = {
        sdk: null as any, // Will be injected by the runtime
        redis: undefined, // Optional Redis for caching
      };

      // Initialize all 5 IoT tool functions
      const tools: StructuredToolInterface[] = [
        createGetDeviceListTool(toolConfig),
        createGetDeviceDetailsTool(toolConfig),
        createGetDeviceTelemetryTool(toolConfig),
        createRegisterWebhookTool(toolConfig),
        createGetKPIMetricsTool(toolConfig),
      ];

      // Convert tools to the format expected by the LLM provider
      const toolDefs = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.schema,
      }));

      // Get the last user message from state
      const lastMessage = state.messages[state.messages.length - 1];
      const userInput =
        lastMessage && 'content' in lastMessage
          ? String(lastMessage.content)
          : '';

      // Prepare messages for the LLM
      const messages = [
        {
          role: 'system' as const,
          content: IOT_DOMAIN_PROMPT,
        },
        {
          role: 'user' as const,
          content: userInput,
        },
      ];

      // Call the LLM with tools
      const response = await provider.complete({
        model: provider.config.defaultModel || 'claude-opus-4-6',
        messages,
        max_tokens: 4096,
        temperature: 0.4,
        tools: toolDefs,
      });

      // Process tool calls if any
      let finalAnswer = '';
      const toolResults: Array<{ tool: string; result: any }> = [];

      if (response.content && Array.isArray(response.content)) {
        for (const block of response.content) {
          if (block.type === 'text') {
            finalAnswer += block.text;
          } else if (block.type === 'tool_use') {
            // Find the matching tool and execute it
            const tool = tools.find((t) => t.name === block.name);
            if (tool) {
              try {
                const result = await tool._call(block.input);
                toolResults.push({ tool: block.name, result });

                // Add tool result to messages and continue conversation
                messages.push({
                  role: 'assistant' as const,
                  content: JSON.stringify(response.content),
                });
                messages.push({
                  role: 'user' as const,
                  content: `Tool ${block.name} returned: ${JSON.stringify(result)}`,
                });

                // Get follow-up response with tool results
                const followUp = await provider.complete({
                  model: provider.config.defaultModel || 'claude-opus-4-6',
                  messages,
                  max_tokens: 4096,
                  temperature: 0.4,
                });

                if (followUp.content && Array.isArray(followUp.content)) {
                  for (const followUpBlock of followUp.content) {
                    if (followUpBlock.type === 'text') {
                      finalAnswer += followUpBlock.text;
                    }
                  }
                }
              } catch (toolError) {
                // Handle tool execution errors gracefully
                const errorMessage =
                  toolError instanceof Error
                    ? toolError.message
                    : 'Unknown error';
                finalAnswer += `\n\nI encountered an error while trying to fetch device data: ${errorMessage}. `;
                finalAnswer +=
                  'I can still help answer general IoT questions based on my knowledge of the Friendly One-IoT platform.';

                // Log the error for debugging
                console.error(`Tool execution error (${block.name}):`, toolError);
              }
            }
          }
        }
      } else if (typeof response.content === 'string') {
        finalAnswer = response.content;
      }

      // Fallback response if no answer was generated
      if (!finalAnswer.trim()) {
        finalAnswer =
          'I apologize, but I was unable to generate a response. Could you please rephrase your question about IoT devices or the Friendly One-IoT platform?';
      }

      // Return updated state with the answer
      return {
        messages: [...state.messages, new AIMessage(finalAnswer)],
        currentAgent: AgentRole.IOT_DOMAIN,
      };
    } catch (error) {
      // Handle any errors that occur during agent execution
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      console.error('IoT Domain agent error:', error);

      // Return error state with a user-friendly message
      const fallbackMessage =
        'I encountered an issue while processing your IoT query. ' +
        'Please try again or rephrase your question. ' +
        `(Error: ${errorMessage})`;

      return {
        messages: [...state.messages, new AIMessage(fallbackMessage)],
        currentAgent: AgentRole.IOT_DOMAIN,
        errors: [
          ...(state.errors || []),
          {
            agent: AgentRole.IOT_DOMAIN,
            message: errorMessage,
            timestamp: new Date(),
            recoverable: true,
          },
        ],
      };
    }
  };
}
