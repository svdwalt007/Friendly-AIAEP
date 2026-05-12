import type { Meta, StoryObj } from '@storybook/angular';
import { TelemetryChartComponent } from './telemetry-chart.component';

function makeData(count: number, seed = 50): Array<{ timestamp: string; value: number }> {
  const now = Date.now();
  let v = seed;
  return Array.from({ length: count }, (_, i) => {
    v = Math.max(0, Math.min(100, v + (Math.random() - 0.5) * 10));
    return {
      timestamp: new Date(now - (count - i) * 60_000).toISOString(),
      value: Math.round(v * 10) / 10,
    };
  });
}

const meta: Meta<TelemetryChartComponent> = {
  title: 'Components/Telemetry Chart',
  component: TelemetryChartComponent,
  tags: ['autodocs'],
  argTypes: {
    height: { control: 'text' },
    width:  { control: 'text' },
    unit:   { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<TelemetryChartComponent>;

export const Temperature: Story = {
  args: {
    data:   makeData(60, 22),
    height: '120px',
    unit:   '°C',
  },
};

export const BatterySparkline: Story = {
  args: {
    data:   makeData(20, 80),
    height: '60px',
    unit:   '%',
  },
};

export const Flat: Story = {
  args: {
    data: Array.from({ length: 10 }, (_, i) => ({
      timestamp: new Date(Date.now() - (10 - i) * 60_000).toISOString(),
      value: 42,
    })),
    height: '80px',
    unit: 'kPa',
  },
};

export const Insufficient: Story = {
  args: {
    data:   [{ timestamp: new Date().toISOString(), value: 10 }],
    height: '80px',
  },
};
