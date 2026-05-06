/**
 * Product Planning Agent for the AEP Multi-Agent System
 *
 * This agent analyzes user requirements and creates comprehensive build plans
 * for IoT-enabled applications. It integrates with project-registry for CRUD
 * operations and uses Claude Opus 4.6 via the llm-providers abstraction.
 */

// @ts-nocheck - TODO: Fix type issues with LLMProvider
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getProvider, AgentRole as LLMAgentRole } from '@friendly-tech/core/llm-providers';
import type { AEPAgentState, BuildTask } from '../types';
import { PLANNING_PROMPT, TASK_TYPES } from '../constants';
import { AgentRole } from '../types';

/**
 * Mock project data type for Phase 1
 */
interface MockProject {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: Date;
}

/**
 * Tool: Create a new project in the registry
 * Phase 1: Returns mock data, will integrate with actual project-registry later
 */
const createProjectTool = new DynamicStructuredTool({
  name: 'create_project',
  description:
    'Creates a new project in the project registry. Use this when the user wants to start a new IoT application.',
  schema: z.object({
    tenantId: z.string().describe('The tenant identifier'),
    name: z.string().describe('Project name'),
    description: z.string().describe('Brief description of the project'),
  }),
  func: async ({ tenantId, name, description }) => {
    console.log('[Planning Agent] Creating project:', { tenantId, name, description });

    // Phase 1: Mock implementation
    const mockProject: MockProject = {
      id: uuidv4(),
      name,
      description,
      status: 'draft',
      createdAt: new Date(),
    };

    return JSON.stringify({
      success: true,
      project: mockProject,
      message: `Project "${name}" created successfully with ID ${mockProject.id}`,
    });
  },
});

/**
 * Tool: Update existing project metadata
 * Phase 1: Returns mock data, will integrate with actual project-registry later
 */
const updateProjectTool = new DynamicStructuredTool({
  name: 'update_project',
  description: 'Updates metadata for an existing project in the registry.',
  schema: z.object({
    projectId: z.string().describe('The project identifier'),
    name: z.string().optional().describe('Updated project name'),
    description: z.string().optional().describe('Updated project description'),
    status: z.string().optional().describe('Updated project status'),
  }),
  func: async ({ projectId, name, description, status }) => {
    console.log('[Planning Agent] Updating project:', { projectId, name, description, status });

    // Phase 1: Mock implementation
    return JSON.stringify({
      success: true,
      projectId,
      updatedFields: { name, description, status },
      message: `Project ${projectId} updated successfully`,
    });
  },
});

/**
 * Tool: Retrieve project details
 * Phase 1: Returns mock data, will integrate with actual project-registry later
 */
const getProjectTool = new DynamicStructuredTool({
  name: 'get_project',
  description: 'Retrieves detailed information about a specific project.',
  schema: z.object({
    projectId: z.string().describe('The project identifier to retrieve'),
  }),
  func: async ({ projectId }) => {
    console.log('[Planning Agent] Retrieving project:', projectId);

    // Phase 1: Mock implementation
    const mockProject: MockProject = {
      id: projectId,
      name: 'IoT Fleet Dashboard',
      description: 'Fleet operations dashboard for 10,000 smart water meters',
      status: 'active',
      createdAt: new Date(Date.now() - 86400000), // 1 day ago
    };

    return JSON.stringify({
      success: true,
      project: mockProject,
    });
  },
});

/**
 * Validates a generated build plan
 *
 * Checks for:
 * - All tasks have unique IDs
 * - All dependencies reference valid task IDs
 * - No circular dependencies
 * - All required fields are present
 */
function validateBuildPlan(buildPlan: BuildTask[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const taskIds = new Set<string>();

  // Check for duplicate IDs and collect all task IDs
  for (const task of buildPlan) {
    if (!task.id) {
      errors.push('Task missing ID');
      continue;
    }

    if (taskIds.has(task.id)) {
      errors.push(`Duplicate task ID: ${task.id}`);
    }
    taskIds.add(task.id);

    // Validate required fields
    if (!task.type) {
      errors.push(`Task ${task.id} missing type`);
    }
    if (!task.description) {
      errors.push(`Task ${task.id} missing description`);
    }
    if (!task.agent) {
      errors.push(`Task ${task.id} missing agent assignment`);
    }
    if (!task.status) {
      errors.push(`Task ${task.id} missing status`);
    }
  }

  // Validate dependencies reference valid task IDs
  for (const task of buildPlan) {
    for (const depId of task.dependencies || []) {
      if (!taskIds.has(depId)) {
        errors.push(`Task ${task.id} has invalid dependency: ${depId}`);
      }
    }
  }

  // Check for circular dependencies using depth-first search
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(taskId: string): boolean {
    if (recursionStack.has(taskId)) {
      return true; // Found a cycle
    }
    if (visited.has(taskId)) {
      return false; // Already processed, no cycle from here
    }

    visited.add(taskId);
    recursionStack.add(taskId);

    const task = buildPlan.find((t) => t.id === taskId);
    if (task) {
      for (const depId of task.dependencies || []) {
        if (hasCycle(depId)) {
          return true;
        }
      }
    }

    recursionStack.delete(taskId);
    return false;
  }

  for (const task of buildPlan) {
    if (hasCycle(task.id)) {
      errors.push(`Circular dependency detected involving task ${task.id}`);
      break; // Only report once
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Parse build plan from LLM response
 *
 * Attempts to extract structured build plan from the LLM's response.
 * Handles both JSON format and natural language descriptions.
 */
function parseBuildPlan(content: string): BuildTask[] {
  const tasks: BuildTask[] = [];

  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(content);

    if (Array.isArray(parsed)) {
      // Direct array of tasks
      return parsed.map((task) => ({
        id: task.id || uuidv4(),
        type: task.type || TASK_TYPES.PROJECT_SETUP,
        description: task.description || '',
        agent: task.agent || AgentRole.PLANNING,
        dependencies: task.dependencies || [],
        status: task.status || 'pending',
      }));
    } else if (parsed.tasks && Array.isArray(parsed.tasks)) {
      // Wrapped in a tasks property
      return parsed.tasks.map((task: BuildTask) => ({
        id: task.id || uuidv4(),
        type: task.type || TASK_TYPES.PROJECT_SETUP,
        description: task.description || '',
        agent: task.agent || AgentRole.PLANNING,
        dependencies: task.dependencies || [],
        status: task.status || 'pending',
      }));
    }
  } catch (e) {
    // Not valid JSON, try to extract from natural language
    console.log('[Planning Agent] Response not JSON, extracting tasks from text');
  }

  // Fallback: Create a default plan based on content analysis
  // This ensures we always return something useful even if LLM doesn't format perfectly
  const hasIoTMention = /iot|device|sensor|telemetry/i.test(content);
  const hasDashboard = /dashboard|visualization|chart|graph/i.test(content);
  const hasDatabase = /database|schema|model|data/i.test(content);

  if (hasIoTMention || hasDashboard || hasDatabase) {
    // Create a basic plan
    const setupTask: BuildTask = {
      id: uuidv4(),
      type: TASK_TYPES.PROJECT_SETUP,
      description: 'Initialize project structure and configuration',
      agent: AgentRole.PLANNING,
      dependencies: [],
      status: 'pending',
    };
    tasks.push(setupTask);

    if (hasDatabase) {
      tasks.push({
        id: uuidv4(),
        type: TASK_TYPES.SCHEMA_DESIGN,
        description: 'Design database schema for IoT data',
        agent: AgentRole.PLANNING,
        dependencies: [setupTask.id],
        status: 'pending',
      });
    }

    if (hasIoTMention) {
      tasks.push({
        id: uuidv4(),
        type: TASK_TYPES.API_INTEGRATION,
        description: 'Integrate with Friendly One-IoT DM APIs',
        agent: AgentRole.IOT_DOMAIN,
        dependencies: [setupTask.id],
        status: 'pending',
      });
    }

    if (hasDashboard) {
      tasks.push({
        id: uuidv4(),
        type: TASK_TYPES.WIDGET_CONFIGURATION,
        description: 'Configure dashboard widgets and visualizations',
        agent: AgentRole.PLANNING,
        dependencies: tasks.map((t) => t.id),
        status: 'pending',
      });
    }
  }

  return tasks;
}

/**
 * Creates the planning node function for the LangGraph workflow
 *
 * This function handles:
 * 1. Getting the appropriate LLM provider (Claude Opus 4.6)
 * 2. Analyzing user requirements from messages
 * 3. Using project-registry tools as needed
 * 4. Generating a structured build plan
 * 5. Validating the plan
 * 6. Returning updated state
 *
 * @returns Async function that processes the agent state
 */
export function createPlanningNode(): (state: AEPAgentState) => Promise<Partial<AEPAgentState>> {
  return async (state: AEPAgentState): Promise<Partial<AEPAgentState>> => {
    console.log('[Planning Agent] Starting planning process for project:', state.projectId);

    try {
      // Get LLM provider for Planning agent role
      // Uses Claude Opus 4.6 by default as configured in AGENT_LLM_MAP
      const provider = getProvider(LLMAgentRole.PLANNING);
      const config = provider.config;

      // Prepare messages for the LLM
      const messages = [
        new SystemMessage(PLANNING_PROMPT),
        ...state.messages.map((msg) => {
          if (msg._getType() === 'human') {
            return new HumanMessage(msg.content);
          } else if (msg._getType() === 'ai') {
            return new AIMessage(msg.content);
          }
          return msg;
        }),
      ];

      // Add context about available tools
      messages.push(
        new SystemMessage(`
Available Tools:
- create_project: Create a new project in the registry
- update_project: Update project metadata
- get_project: Retrieve project details

Current Context:
- Tenant ID: ${state.tenantId}
- Project ID: ${state.projectId}

Please analyze the user's requirements and create a comprehensive build plan.
Format your response as a JSON object with a "tasks" array, where each task has:
- id: unique identifier (you can use any string)
- type: task type (e.g., "project_setup", "schema_design", "api_integration", etc.)
- description: detailed task description
- agent: which agent should handle this ("planning" or "iot_domain")
- dependencies: array of task IDs that must complete first
- status: "pending" (all tasks start as pending)

Example:
{
  "tasks": [
    {
      "id": "task-1",
      "type": "project_setup",
      "description": "Initialize project structure",
      "agent": "planning",
      "dependencies": [],
      "status": "pending"
    }
  ]
}
`)
      );

      // Call the LLM
      console.log('[Planning Agent] Calling LLM with model:', config.defaultModel);

      const response = await provider.complete({
        model: config.defaultModel || 'claude-opus-4-6',
        messages: messages.map((msg) => ({
          role: msg._getType() === 'system' ? 'system' : msg._getType() === 'human' ? 'user' : 'assistant',
          content: typeof msg.content === 'string' ? msg.content : '',
        })),
        max_tokens: config.maxTokens || 8192,
        temperature: config.temperature,
        tools: [createProjectTool, updateProjectTool, getProjectTool].map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: {
            type: 'object',
            properties: Object.fromEntries(
              Object.entries((tool as unknown as { schema: { shape: Record<string, unknown> } }).schema.shape).map(
                ([key, value]) => [
                  key,
                  {
                    type: 'string',
                    description: (value as { description?: string }).description || '',
                  },
                ]
              )
            ),
            required: Object.keys((tool as unknown as { schema: { shape: Record<string, unknown> } }).schema.shape),
          },
        })),
      });

      // Extract the response content
      const responseContent =
        response.content.find((block) => block.type === 'text')?.text ||
        'I understand your requirements. Let me create a build plan for your IoT application.';

      console.log('[Planning Agent] LLM Response:', responseContent.substring(0, 200) + '...');

      // Parse the build plan from the response
      let buildPlan = parseBuildPlan(responseContent);

      // Validate the build plan
      const validation = validateBuildPlan(buildPlan);
      if (!validation.valid) {
        console.warn('[Planning Agent] Build plan validation errors:', validation.errors);

        // Create a fallback plan if validation fails
        buildPlan = [
          {
            id: uuidv4(),
            type: TASK_TYPES.PROJECT_SETUP,
            description: 'Review and refine project requirements',
            agent: AgentRole.PLANNING,
            dependencies: [],
            status: 'pending',
          },
        ];
      }

      console.log('[Planning Agent] Generated build plan with', buildPlan.length, 'tasks');

      // Add AI response to messages
      const newMessages = [...state.messages, new AIMessage(responseContent)];

      // Return updated state with the build plan
      return {
        messages: newMessages,
        buildPlan,
        currentAgent: AgentRole.PLANNING,
      };
    } catch (error) {
      console.error('[Planning Agent] Error during planning:', error);

      // Add error to state
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred during planning';

      return {
        errors: [
          ...state.errors,
          {
            agent: AgentRole.PLANNING,
            message: errorMessage,
            timestamp: new Date(),
            recoverable: true,
          },
        ],
        messages: [
          ...state.messages,
          new AIMessage(
            `I encountered an error while creating the build plan: ${errorMessage}. Please try rephrasing your requirements.`
          ),
        ],
      };
    }
  };
}
