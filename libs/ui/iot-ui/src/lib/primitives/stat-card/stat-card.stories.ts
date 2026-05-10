/**
 * @file Storybook stories for FriendlyStatCard.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import type { Meta, StoryObj } from '@storybook/angular';
import { FriendlyStatCard } from './stat-card';

const meta: Meta<FriendlyStatCard> = {
  title: 'AEP v2/Primitives/StatCard',
  component: FriendlyStatCard,
  tags: ['autodocs'],
  argTypes: {
    label: { control: { type: 'text' } },
    value: { control: { type: 'text' } },
    unit: { control: { type: 'text' } },
    delta: { control: { type: 'number' } },
    trend: {
      control: { type: 'select' },
      options: [null, 'up', 'down', 'flat'],
    },
    showSpark: { control: { type: 'boolean' } },
    sparkSeed: { control: { type: 'number' } },
    sparkWidth: { control: { type: 'number', min: 40, max: 600, step: 10 } },
    sparkHeight: { control: { type: 'number', min: 16, max: 120, step: 4 } },
    ariaLabel: { control: { type: 'text' } },
  },
};

export default meta;

type Story = StoryObj<FriendlyStatCard>;

export const Default: Story = {
  args: {
    label: 'Active devices',
    value: 12_834,
    unit: null,
    delta: null,
    trend: null,
    showSpark: true,
    sparkSeed: 42,
    sparkWidth: 220,
    sparkHeight: 40,
    ariaLabel: '',
  },
};

export const PositiveDelta: Story = {
  args: {
    label: 'Provisioning success',
    value: 98.7,
    unit: '%',
    delta: 1.2,
    showSpark: true,
    sparkSeed: 7,
  },
};

export const NegativeDelta: Story = {
  args: {
    label: 'API p95 latency',
    value: 142,
    unit: 'ms',
    delta: -8.3,
    showSpark: true,
    sparkSeed: 19,
  },
};

export const Flat: Story = {
  args: {
    label: 'Sessions',
    value: 1024,
    delta: 0,
    showSpark: true,
    sparkSeed: 5,
  },
};

export const NoSpark: Story = {
  args: {
    label: 'Errors / hr',
    value: 4,
    delta: -2,
    showSpark: false,
  },
};

export const ExplicitTrendOverride: Story = {
  args: {
    label: 'Adoption',
    value: '12k',
    delta: -100,
    trend: 'up',
    showSpark: true,
    sparkSeed: 21,
  },
};
