/**
 * @file Storybook stories for FriendlyStreamChunk.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import type { Meta, StoryObj } from '@storybook/angular';
import { FriendlyStreamChunk } from './stream-chunk';

const meta: Meta<FriendlyStreamChunk> = {
  title: 'AEP v2/Primitives/StreamChunk',
  component: FriendlyStreamChunk,
  tags: ['autodocs'],
  argTypes: {
    kind: {
      control: { type: 'select' },
      options: [
        'final',
        'reasoning',
        'tool_call',
        'tool_result',
        'code_block',
        'file_write',
        'error',
        'progress',
        'agent_handoff',
      ],
    },
    payload: { control: { type: 'object' } },
    ariaLiveOverride: {
      control: { type: 'select' },
      options: [null, 'off', 'polite', 'assertive'],
    },
  },
};

export default meta;

type Story = StoryObj<FriendlyStreamChunk>;

export const Final: Story = {
  args: {
    kind: 'final',
    payload: { content: 'The agent has finished drafting your project plan.' },
  },
};

export const Reasoning: Story = {
  args: {
    kind: 'reasoning',
    payload: {
      content: 'Considering whether to invoke the device-discovery tool.',
    },
  },
};

export const ToolCall: Story = {
  name: 'Tool call',
  args: {
    kind: 'tool_call',
    payload: {
      content: '{"q":"GET /api/v1/devices?limit=10"}',
      tool: 'http.get',
    },
  },
};

export const ToolResult: Story = {
  name: 'Tool result',
  args: {
    kind: 'tool_result',
    payload: {
      content: '10 devices returned (latency 84ms)',
      tool: 'http.get',
    },
  },
};

export const CodeBlock: Story = {
  name: 'Code block',
  args: {
    kind: 'code_block',
    payload: {
      language: 'typescript',
      content: `import { FriendlyStreamChunk } from '@friendly-tech/ui/iot-ui';\n\nconst chunk = { kind: 'progress', payload: { content: 'ok' } };`,
    },
  },
};

export const FileWrite: Story = {
  name: 'File write',
  args: {
    kind: 'file_write',
    payload: {
      src: 'https://placehold.co/600x300?text=Diagram',
      alt: 'Architecture diagram showing the AEP runtime',
    },
  },
};

export const Error: Story = {
  args: {
    kind: 'error',
    payload: { content: 'Tool invocation timed out after 30s.' },
  },
};

export const Progress: Story = {
  args: {
    kind: 'progress',
    payload: {
      content: 'Plan generated — awaiting user approval.',
      timestamp: '2026-05-10T01:23:45Z',
    },
  },
};

export const AgentHandoff: Story = {
  name: 'Agent handoff',
  args: {
    kind: 'agent_handoff',
    payload: {
      source: 'supervisor → planning-agent',
      href: 'agent://planning',
      content: 'Routing task decomposition to the planning agent.',
    },
  },
};
