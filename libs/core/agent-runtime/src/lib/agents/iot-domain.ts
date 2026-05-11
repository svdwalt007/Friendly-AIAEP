/**
 * @fileoverview IoT Domain Agent — handles IoT-specific queries and device operations.
 * @module @friendly-tech/core/agent-runtime/agents
 */

import { AIMessage } from '@langchain/core/messages';
import { getProviderInterface, AgentRole as LLMAgentRole } from '@friendly-tech/core/llm-providers';
import type { Tool, ProviderMessage } from '@friendly-tech/core/llm-providers';
import {
  createGetDeviceListTool,
  createGetDeviceDetailsTool,
  createGetDeviceTelemetryTool,
  createRegisterWebhookTool,
  createGetKPIMetricsTool,
  type ToolConfig,
} from '@friendly-tech/iot/iot-tool-functions';
import type { AEPAgentState } from '../types';
import { AgentRole } from '../types';
import { IOT_DOMAIN_PROMPT } from '../constants';

/**
 * Creates the IoT Domain agent node for LangGraph.
 *
 * In production the `toolConfig` parameter must be populated with a real
 * `IoTSdk` instance (typically a `FallbackSdk`) and, optionally, a Redis
 * client for response caching.  The calling code (e.g. the API gateway route
 * that streams the agent) is responsible for constructing and injecting these
 * dependencies at request time so that per-tenant credentials are used.
 *
 * The agent specialises in IoT-related queries and has access to all five
 * IoT tool functions for querying device data, telemetry, and KPI metrics
 * from the Friendly One-IoT DM platform.
 *
 * @param toolConfig - IoT SDK and optional Redis cache configuration.
 * @returns Agent node function that processes state and returns updated state.
 *
 * @example
 * ```typescript
 * import { createIoTDomainNode } from './agents/iot-domain';
 *
 * const iotDomainNode = createIoTDomainNode({
 *   sdk: myFallbackSdkInstance,
 *   redis: myRedisClient,
 * });
 * const result = await iotDomainNode(state);
 * ```
 */
export function createIoTDomainNode(
  toolConfig: ToolConfig
): (state: AEPAgentState) => Promise<Partial<AEPAgentState>> {
  return async (state: AEPAgentState): Promise<Partial<AEPAgentState>> => {
    try {
      // Get the LLM provider for IoT Domain agent (Claude Opus 4.6).
      // LLMAgentRole.IOT_DOMAIN = 'IOT_DOMAIN' (as defined in llm-providers/usage-tracker).
      const provider = getProviderInterface(LLMAgentRole.IOT_DOMAIN);

      // Initialise all 5 IoT tool functions with the injected configuration.
      const langchainTools = [
        createGetDeviceListTool(toolConfig),
        createGetDeviceDetailsTool(toolConfig),
        createGetDeviceTelemetryTool(toolConfig),
        createRegisterWebhookTool(toolConfig),
        createGetKPIMetricsTool(toolConfig),
      ];

      // Convert LangChain StructuredTool instances to the LLM provider's Tool format.
      const toolDefs: Tool[] = langchainTools.map((t) => ({
        name: t.name,
        description: t.description,
        // The `schema` property on DynamicStructuredTool / StructuredTool exposes
        // the raw Zod schema — which is compatible with ToolParameterSchema when
        // interpreted as a JSON Schema object.
        parameters: t.schema as unknown as Tool['parameters'],
      }));

      // Get the last user message from state.
      const lastMessage = state.messages[state.messages.length - 1];
      const userInput =
        lastMessage != null && 'content' in lastMessage
          ? String(lastMessage.content)
          : '';

      // Prepare the initial message array.
      const messages: ProviderMessage[] = [
        { role: 'system', content: IOT_DOMAIN_PROMPT },
        { role: 'user', content: userInput },
      ];

      // First LLM call — may include tool_use blocks.
      const response = await provider.complete({
        model: provider.config.defaultModel ?? 'claude-opus-4-6',
        messages,
        max_tokens: 4096,
        temperature: 0.4,
        tools: toolDefs,
      });

      let finalAnswer = '';

      // Process each content block in the response.
      for (const block of response.content) {
        if (block.type === 'text') {
          finalAnswer += block.text;
        } else if (block.type === 'tool_use') {
          // Locate the matching LangChain tool and execute it.
          const tool = langchainTools.find((t) => t.name === block.name);
          if (tool) {
            try {
              const toolResult = await tool.invoke(block.input);

              // Append assistant turn + tool result, then ask for follow-up.
              messages.push({ role: 'assistant', content: JSON.stringify(response.content) });
              messages.push({
                role: 'user',
                content: `Tool ${block.name} returned: ${JSON.stringify(toolResult)}`,
              });

              // Follow-up call incorporating the tool result.
              const followUp = await provider.complete({
                model: provider.config.defaultModel ?? 'claude-opus-4-6',
                messages,
                max_tokens: 4096,
                temperature: 0.4,
              });

              for (const followUpBlock of followUp.content) {
                if (followUpBlock.type === 'text') {
                  finalAnswer += followUpBlock.text;
                }
              }
            } catch (toolError) {
              const errMsg =
                toolError instanceof Error ? toolError.message : 'Unknown error';
              finalAnswer +=
                `\n\nI encountered an error while trying to fetch device data: ${errMsg}. ` +
                'I can still help answer general IoT questions based on my knowledge of ' +
                'the Friendly One-IoT platform.';
              console.error(`Tool execution error (${block.name}):`, toolError);
            }
          }
        }
      }

      // Provide a safe fallback if no answer was generated.
      if (!finalAnswer.trim()) {
        finalAnswer =
          'I apologise, but I was unable to generate a response. Could you please ' +
          'rephrase your question about IoT devices or the Friendly One-IoT platform?';
      }

      return {
        messages: [...state.messages, new AIMessage(finalAnswer)],
        currentAgent: AgentRole.IOT_DOMAIN,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      console.error('IoT Domain agent error:', error);

      return {
        messages: [
          ...state.messages,
          new AIMessage(
            'I encountered an issue while processing your IoT query. ' +
              'Please try again or rephrase your question. ' +
              `(Error: ${errorMessage})`
          ),
        ],
        currentAgent: AgentRole.IOT_DOMAIN,
        errors: [
          ...(state.errors ?? []),
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
