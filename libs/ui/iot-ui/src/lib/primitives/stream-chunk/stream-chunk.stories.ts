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
        'text',
        'thought',
        'tool_call',
        'tool_result',
        'code',
        'image',
        'error',
        'status',
        'citation',
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

export const Text: Story = {
  args: {
    kind: 'text',
    payload: { content: 'The agent has finished drafting your project plan.' },
  },
};

export const Thought: Story = {
  args: {
    kind: 'thought',
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

export const Code: Story = {
  args: {
    kind: 'code',
    payload: {
      language: 'typescript',
      content: `import { FriendlyStreamChunk } from '@friendly-tech/ui/iot-ui';\n\nconst chunk = { kind: 'status', payload: { content: 'ok' } };`,
    },
  },
};

export const Image: Story = {
  args: {
    kind: 'image',
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

export const Status: Story = {
  args: {
    kind: 'status',
    payload: {
      content: 'Plan generated — awaiting user approval.',
      timestamp: '2026-05-10T01:23:45Z',
    },
  },
};

export const Citation: Story = {
  args: {
    kind: 'citation',
    payload: {
      source: 'OMA TS LightweightM2M Core v2.0',
      href: 'https://www.openmobilealliance.org/release/LightweightM2M/V2_0-20210922-A/',
      content: 'Section 6.2.1 — Bootstrap-Request operation.',
    },
  },
};
