import type { Meta, StoryObj } from '@storybook/angular';
import { DeviceCardComponent } from './device-card.component';

const meta: Meta<DeviceCardComponent> = {
  title: 'Components/Device Card',
  component: DeviceCardComponent,
  tags: ['autodocs'],
  argTypes: {
    select: { action: 'selected', description: 'Emitted when the card is clicked' },
  },
};

export default meta;
type Story = StoryObj<DeviceCardComponent>;

export const Online: Story = {
  args: {
    device: {
      id: 'DEV-001',
      name: 'Smart Meter Alpha',
      status: 'online',
      battery: 82,
      signal: 91,
      lastSeen: new Date(Date.now() - 2 * 60_000).toISOString(),
    },
  },
};

export const Offline: Story = {
  args: {
    device: {
      id: 'DEV-002',
      name: 'Gateway Node B',
      status: 'offline',
      battery: 15,
      signal: 0,
      lastSeen: new Date(Date.now() - 3 * 3600_000).toISOString(),
    },
  },
};

export const Warning: Story = {
  args: {
    device: {
      id: 'DEV-003',
      name: 'Pressure Sensor C',
      status: 'warning',
      battery: 45,
      signal: 58,
      lastSeen: new Date(Date.now() - 12 * 60_000).toISOString(),
    },
  },
};

export const LowBattery: Story = {
  args: {
    device: {
      id: 'DEV-004',
      name: 'Temperature Node D',
      status: 'online',
      battery: 8,
      signal: 77,
      lastSeen: new Date(Date.now() - 45_000).toISOString(),
    },
  },
};
