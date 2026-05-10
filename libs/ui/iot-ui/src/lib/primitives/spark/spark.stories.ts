/**
 * @file Storybook stories for FriendlySpark.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import type { Meta, StoryObj } from '@storybook/angular';
import { FriendlySpark } from './spark';

const meta: Meta<FriendlySpark> = {
  title: 'AEP v2/Primitives/Spark',
  component: FriendlySpark,
  tags: ['autodocs'],
  argTypes: {
    seed: { control: { type: 'number' } },
    width: { control: { type: 'number', min: 40, max: 600, step: 10 } },
    height: { control: { type: 'number', min: 16, max: 200, step: 4 } },
    pointCount: { control: { type: 'number', min: 2, max: 256, step: 1 } },
    ariaLabel: { control: { type: 'text' } },
  },
};

export default meta;

type Story = StoryObj<FriendlySpark>;

export const Default: Story = {
  args: {
    seed: 0,
    width: 220,
    height: 40,
    pointCount: 32,
    ariaLabel: 'Sparkline',
  },
};

export const SeededTwelve: Story = {
  name: 'Seed = 12',
  args: { seed: 12, width: 220, height: 40, pointCount: 32 },
};

export const Wide: Story = {
  args: { seed: 7, width: 480, height: 80, pointCount: 64 },
};

export const Compact: Story = {
  args: { seed: 99, width: 120, height: 24, pointCount: 16 },
};

export const HighDensity: Story = {
  name: '128 points',
  args: { seed: 3, width: 360, height: 60, pointCount: 128 },
};
