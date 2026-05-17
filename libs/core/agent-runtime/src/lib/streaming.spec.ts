/**
 * Tests for Agent Streaming Interface
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import {
  AgentStream,
  streamAgentResponse,
  createMockGraph,
  sendChunkToWebSocket,
  type StreamConfig,
  type StreamChunk,
  type CompiledGraph,
} from './streaming';
import type { AEPAgentState } from './types';
import { AgentRole } from './types';

describe('streaming', () => {
  let mockState: Partial<AEPAgentState>;
  let streamConfig: StreamConfig;

  beforeEach(() => {
    mockState = {
      messages: [new HumanMessage('Test message')],
      currentAgent: AgentRole.SUPERVISOR,
      projectId: 'test-project',
      tenantId: 'test-tenant',
      buildPlan: [],
      completedTasks: [],
      generatedAssets: [],
      errors: [],
      approvals: [],
    };

    streamConfig = {
      thread_id: 'test-thread-123',
      debug: false,
    };
  });

  describe('streamAgentResponse', () => {
    it('should yield completion chunk for successful execution', async () => {
      // Create a simple mock graph that yields one state update
      const mockGraph = createMockGraph(async function* (input) {
        yield ['supervisor', { ...input, currentAgent: AgentRole.SUPERVISOR }];
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of streamAgentResponse(mockGraph, mockState, streamConfig)) {
        chunks.push(chunk);
      }

      // Should yield at least a completion chunk
      expect(chunks.length).toBeGreaterThan(0);
      const completionChunk = chunks.find(c => c.type === 'completion');
      expect(completionChunk).toBeDefined();
      expect(completionChunk?.thread_id).toBe('test-thread-123');
    });

    it('should detect agent transitions', async () => {
      const mockGraph = createMockGraph(async function* (input) {
        yield ['supervisor', { ...input, currentAgent: AgentRole.SUPERVISOR }];
        yield ['planning', { ...input, currentAgent: AgentRole.PLANNING }];
        yield ['iot_domain', { ...input, currentAgent: AgentRole.IOT_DOMAIN }];
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of streamAgentResponse(mockGraph, mockState, streamConfig)) {
        chunks.push(chunk);
      }

      // Should have agent_thinking chunks for transitions
      const thinkingChunks = chunks.filter(c => c.type === 'agent_thinking');
      expect(thinkingChunks.length).toBeGreaterThan(0);

      // Verify agents
      const agents = thinkingChunks.map(c => (c as any).agent);
      expect(agents).toContain(AgentRole.PLANNING);
      expect(agents).toContain(AgentRole.IOT_DOMAIN);
    });

    it('should detect new messages', async () => {
      const mockGraph = createMockGraph(async function* (input) {
        const newMessages = [
          ...(input.messages || []),
          new AIMessage('Agent response'),
        ];
        yield ['planning', { ...input, messages: newMessages }];
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of streamAgentResponse(mockGraph, mockState, streamConfig)) {
        chunks.push(chunk);
      }

      // Should have agent_response chunk
      const responseChunks = chunks.filter(c => c.type === 'agent_response');
      expect(responseChunks.length).toBe(1);
      expect((responseChunks[0] as any).content).toContain('Agent response');
    });

    it('should detect build plan updates', async () => {
      const mockGraph = createMockGraph(async function* (input) {
        const buildPlan = [
          {
            id: 'task-1',
            type: 'project_setup',
            description: 'Setup project structure',
            agent: AgentRole.PLANNING,
            dependencies: [],
            status: 'pending' as const,
          },
        ];
        yield ['planning', { ...input, buildPlan }];
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of streamAgentResponse(mockGraph, mockState, streamConfig)) {
        chunks.push(chunk);
      }

      // Should have state update chunk for build plan
      const stateChunks = chunks.filter(
        c => c.type === 'state' && (c as any).updateType === 'build_plan'
      );
      expect(stateChunks.length).toBe(1);
      expect((stateChunks[0] as any).data.totalTasks).toBe(1);
    });

    it('should detect task completions', async () => {
      const task = {
        id: 'task-1',
        type: 'project_setup',
        description: 'Setup project',
        agent: AgentRole.PLANNING,
        dependencies: [],
        status: 'completed' as const,
      };

      const mockGraph = createMockGraph(async function* (input) {
        yield ['planning', { ...input, completedTasks: [task] }];
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of streamAgentResponse(mockGraph, mockState, streamConfig)) {
        chunks.push(chunk);
      }

      // Should have task_update chunk
      const taskChunks = chunks.filter(c => c.type === 'task_update');
      expect(taskChunks.length).toBe(1);
      expect((taskChunks[0] as any).taskId).toBe('task-1');
      expect((taskChunks[0] as any).status).toBe('completed');

      // Should also have state update chunk
      const stateChunks = chunks.filter(
        c => c.type === 'state' && (c as any).updateType === 'task_completed'
      );
      expect(stateChunks.length).toBe(1);
    });

    it('should detect task status changes to in_progress', async () => {
      const buildPlan = [
        {
          id: 'task-1',
          type: 'project_setup',
          description: 'Setup project',
          agent: AgentRole.PLANNING,
          dependencies: [],
          status: 'pending' as const,
        },
      ];

      const mockGraph = createMockGraph(async function* (input) {
        // First yield with pending task
        yield ['planning', { ...input, buildPlan }];

        // Then yield with in_progress task
        const updatedPlan = [{ ...buildPlan[0], status: 'in_progress' as const }];
        yield ['planning', { ...input, buildPlan: updatedPlan }];
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of streamAgentResponse(mockGraph, mockState, streamConfig)) {
        chunks.push(chunk);
      }

      // Should have task_update chunk for in_progress
      const taskChunks = chunks.filter(
        c => c.type === 'task_update' && (c as any).status === 'in_progress'
      );
      expect(taskChunks.length).toBe(1);
      expect((taskChunks[0] as any).taskId).toBe('task-1');
    });

    it('should detect approval requests', async () => {
      const approval = {
        id: 'approval-1',
        type: 'build_plan',
        description: 'Approve build plan',
        status: 'pending' as const,
        requestedAt: new Date(),
      };

      const mockGraph = createMockGraph(async function* (input) {
        yield ['planning', { ...input, approvals: [approval] }];
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of streamAgentResponse(mockGraph, mockState, streamConfig)) {
        chunks.push(chunk);
      }

      // Should have state update chunk for approval request
      const approvalChunks = chunks.filter(
        c => c.type === 'state' && (c as any).updateType === 'approval_requested'
      );
      expect(approvalChunks.length).toBe(1);
      expect((approvalChunks[0] as any).data.id).toBe('approval-1');
    });

    it('should detect and yield errors', async () => {
      const error = {
        agent: AgentRole.PLANNING,
        message: 'Planning failed',
        timestamp: new Date(),
        recoverable: true,
      };

      const mockGraph = createMockGraph(async function* (input) {
        yield ['planning', { ...input, errors: [error] }];
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of streamAgentResponse(mockGraph, mockState, streamConfig)) {
        chunks.push(chunk);
      }

      // Should have error chunk
      const errorChunks = chunks.filter(c => c.type === 'error');
      expect(errorChunks.length).toBe(1);
      expect((errorChunks[0] as any).message).toBe('Planning failed');
      expect((errorChunks[0] as any).recoverable).toBe(true);
    });

    it('should handle streaming errors gracefully', async () => {
      const mockGraph = createMockGraph(async function* () {
        throw new Error('Graph execution failed');
      });

      const chunks: StreamChunk[] = [];

      try {
        for await (const chunk of streamAgentResponse(mockGraph, mockState, streamConfig)) {
          chunks.push(chunk);
        }
      } catch (error) {
        // Expected to throw
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('Graph execution failed');
      }

      // Should have yielded error chunk before throwing
      const errorChunks = chunks.filter(c => c.type === 'error');
      expect(errorChunks.length).toBe(1);
    });

    it('should include debug stack trace when debug is enabled', async () => {
      const debugConfig: StreamConfig = {
        ...streamConfig,
        debug: true,
      };

      const mockGraph = createMockGraph(async function* () {
        throw new Error('Debug test error');
      });

      const chunks: StreamChunk[] = [];

      try {
        for await (const chunk of streamAgentResponse(mockGraph, mockState, debugConfig)) {
          chunks.push(chunk);
        }
      } catch {
        // Expected
      }

      const errorChunks = chunks.filter(c => c.type === 'error');
      expect(errorChunks.length).toBe(1);
      expect((errorChunks[0] as any).stack).toBeDefined();
    });

    it('should include thread_id in all chunks', async () => {
      const mockGraph = createMockGraph(async function* (input) {
        yield ['supervisor', { ...input }];
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of streamAgentResponse(mockGraph, mockState, streamConfig)) {
        chunks.push(chunk);
      }

      // All chunks should have thread_id
      for (const chunk of chunks) {
        expect(chunk.thread_id).toBe('test-thread-123');
      }
    });

    it('should include timestamp in all chunks', async () => {
      const mockGraph = createMockGraph(async function* (input) {
        yield ['supervisor', { ...input }];
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of streamAgentResponse(mockGraph, mockState, streamConfig)) {
        chunks.push(chunk);
      }

      // All chunks should have valid ISO timestamp
      for (const chunk of chunks) {
        expect(chunk.timestamp).toBeDefined();
        expect(() => new Date(chunk.timestamp)).not.toThrow();
      }
    });

    it('should handle multiple message types correctly', async () => {
      const mockGraph = createMockGraph(async function* (input) {
        const newMessages = [
          ...(input.messages || []),
          new HumanMessage('User question'),
          new AIMessage('Agent answer'),
        ];
        yield ['planning', { ...input, messages: newMessages }];
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of streamAgentResponse(mockGraph, mockState, streamConfig)) {
        chunks.push(chunk);
      }

      // Should have both message and agent_response chunks
      const messageChunks = chunks.filter(c => c.type === 'message');
      const responseChunks = chunks.filter(c => c.type === 'agent_response');

      expect(messageChunks.length).toBeGreaterThanOrEqual(1);
      expect(responseChunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('AgentStream', () => {
    it('should create and stream successfully', async () => {
      const mockGraph = createMockGraph(async function* (input) {
        yield ['supervisor', { ...input }];
      });

      const agentStream = new AgentStream(mockGraph, streamConfig);
      expect(agentStream.running).toBe(false);

      const chunks: StreamChunk[] = [];
      for await (const chunk of agentStream.stream(mockState)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(agentStream.running).toBe(false);
    });

    it('should prevent concurrent streams', async () => {
      const mockGraph = createMockGraph(async function* (input) {
        yield ['supervisor', { ...input }];
        // Simulate slow execution
        await new Promise(resolve => setTimeout(resolve, 100));
        yield ['planning', { ...input }];
      });

      const agentStream = new AgentStream(mockGraph, streamConfig);

      // Start first stream
      const stream1Promise = (async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of agentStream.stream(mockState)) {
          chunks.push(chunk);
        }
        return chunks;
      })();

      // Wait a bit to ensure first stream is running
      await new Promise(resolve => setTimeout(resolve, 10));

      // Try to start second stream
      expect(async () => {
        for await (const chunk of agentStream.stream(mockState)) {
          // Should not reach here
        }
      }).rejects.toThrow('Stream is already running');

      await stream1Promise;
    });

    it('should handle errors in stream', async () => {
      const mockGraph = createMockGraph(async function* () {
        throw new Error('Stream error');
      });

      const agentStream = new AgentStream(mockGraph, streamConfig);

      const chunks: StreamChunk[] = [];
      for await (const chunk of agentStream.stream(mockState)) {
        chunks.push(chunk);
      }

      // Should have error chunk
      const errorChunks = chunks.filter(c => c.type === 'error');
      expect(errorChunks.length).toBeGreaterThan(0);
      expect((errorChunks[0] as any).message).toContain('Stream error');
    });

    it('should support cancellation', async () => {
      const mockGraph = createMockGraph(async function* (input) {
        yield ['supervisor', { ...input }];
        await new Promise(resolve => setTimeout(resolve, 1000)); // Long delay
        yield ['planning', { ...input }];
      });

      const agentStream = new AgentStream(mockGraph, streamConfig);

      // Start streaming
      const streamPromise = (async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of agentStream.stream(mockState)) {
          chunks.push(chunk);
        }
        return chunks;
      })();

      // Cancel after a short delay
      await new Promise(resolve => setTimeout(resolve, 50));
      agentStream.cancel();

      const chunks = await streamPromise;

      // Should have received at least some chunks before cancellation
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('sendChunkToWebSocket', () => {
    it('should send chunk as JSON string', () => {
      const sentData: string[] = [];
      const mockConnection = {
        send: (data: string) => sentData.push(data),
      };

      const chunk: StreamChunk = {
        type: 'message',
        timestamp: new Date().toISOString(),
        thread_id: 'test-thread',
        agent: AgentRole.SUPERVISOR,
        content: 'Test message',
        done: true,
      };

      sendChunkToWebSocket(chunk, mockConnection);

      expect(sentData.length).toBe(1);
      const parsed = JSON.parse(sentData[0]);
      expect(parsed.type).toBe('message');
      expect(parsed.content).toBe('Test message');
    });

    it('should handle send errors gracefully', () => {
      const mockConnection = {
        send: () => {
          throw new Error('Connection closed');
        },
      };

      const chunk: StreamChunk = {
        type: 'completion',
        timestamp: new Date().toISOString(),
        thread_id: 'test-thread',
        finalState: {},
      };

      // Should not throw
      expect(() => sendChunkToWebSocket(chunk, mockConnection)).not.toThrow();
    });
  });

  describe('createMockGraph', () => {
    it('should create a valid CompiledGraph', async () => {
      const mockGraph = createMockGraph(async function* (input) {
        yield ['test-node', { ...input }];
      });

      expect(mockGraph.stream).toBeDefined();
      expect(mockGraph.invoke).toBeDefined();

      const results: [string, Partial<AEPAgentState>][] = [];
      for await (const result of mockGraph.stream(mockState, streamConfig)) {
        results.push(result);
      }

      expect(results.length).toBe(1);
      expect(results[0][0]).toBe('test-node');
    });

    it('should support invoke method', async () => {
      const mockGraph = createMockGraph(async function* (input) {
        yield ['test-node', { ...input }];
      });

      const result = await mockGraph.invoke(mockState, streamConfig);
      expect(result).toBeDefined();
    });
  });

  describe('chunk serialization', () => {
    it('should serialize all chunk types to JSON', () => {
      const chunks: StreamChunk[] = [
        {
          type: 'message',
          timestamp: new Date().toISOString(),
          thread_id: 'test',
          agent: AgentRole.SUPERVISOR,
          content: 'Test',
          done: true,
        },
        {
          type: 'state',
          timestamp: new Date().toISOString(),
          thread_id: 'test',
          agent: AgentRole.PLANNING,
          updateType: 'build_plan',
          data: { test: true },
        },
        {
          type: 'error',
          timestamp: new Date().toISOString(),
          thread_id: 'test',
          agent: AgentRole.IOT_DOMAIN,
          message: 'Error',
          recoverable: false,
        },
        {
          type: 'completion',
          timestamp: new Date().toISOString(),
          thread_id: 'test',
          finalState: {},
        },
      ];

      // All chunks should be JSON serializable
      for (const chunk of chunks) {
        expect(() => JSON.stringify(chunk)).not.toThrow();
        const parsed = JSON.parse(JSON.stringify(chunk));
        expect(parsed.type).toBe(chunk.type);
      }
    });
  });
});
