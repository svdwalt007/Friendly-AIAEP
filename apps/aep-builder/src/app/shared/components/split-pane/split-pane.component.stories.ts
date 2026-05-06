import type { Meta, StoryObj } from '@storybook/angular';
import { SplitPaneComponent } from './split-pane.component';

const meta: Meta<SplitPaneComponent> = {
  title: 'Components/Split Pane',
  component: SplitPaneComponent,
  tags: ['autodocs'],
  argTypes: {
    direction: {
      control: 'radio',
      options: ['horizontal', 'vertical'],
      description: 'Direction of the split pane',
    },
    initialSplit: {
      control: { type: 'range', min: 20, max: 80, step: 5 },
      description: 'Initial split position in percentage',
    },
    minSize: {
      control: { type: 'range', min: 10, max: 50, step: 5 },
      description: 'Minimum size of the left/top pane in percentage',
    },
    maxSize: {
      control: { type: 'range', min: 50, max: 90, step: 5 },
      description: 'Maximum size of the left/top pane in percentage',
    },
    resizable: {
      control: 'boolean',
      description: 'Whether the pane is resizable',
    },
    splitChange: {
      action: 'splitChange',
      description: 'Event emitted when split position changes',
    },
    resizeStart: {
      action: 'resizeStart',
      description: 'Event emitted when resize starts',
    },
    resizeEnd: {
      action: 'resizeEnd',
      description: 'Event emitted when resize ends',
    },
  },
  render: (args: any) => ({
    props: args,
    template: `
      <div style="height: 500px; border: 1px solid var(--ft-border-color);">
        <app-split-pane
          [direction]="direction"
          [initialSplit]="initialSplit"
          [minSize]="minSize"
          [maxSize]="maxSize"
          [resizable]="resizable"
          (splitChange)="splitChange($event)"
          (resizeStart)="resizeStart()"
          (resizeEnd)="resizeEnd($event)"
        >
          <div left-pane style="padding: 20px; background-color: var(--ft-surface-secondary);">
            <h3>Left Pane</h3>
            <p>This is the left pane content. You can drag the divider to resize.</p>
          </div>
          <div right-pane style="padding: 20px; background-color: var(--ft-surface-primary);">
            <h3>Right Pane</h3>
            <p>This is the right pane content. It adjusts automatically.</p>
          </div>
        </app-split-pane>
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<SplitPaneComponent>;

export const HorizontalDefault: Story = {
  args: {
    direction: 'horizontal',
    initialSplit: 50,
    minSize: 20,
    maxSize: 80,
    resizable: true,
  },
};

export const Vertical: Story = {
  args: {
    direction: 'vertical',
    initialSplit: 50,
    minSize: 20,
    maxSize: 80,
    resizable: true,
  },
};

export const FixedSplit: Story = {
  args: {
    direction: 'horizontal',
    initialSplit: 50,
    minSize: 20,
    maxSize: 80,
    resizable: false,
  },
};

export const ChatLayout: Story = {
  args: {
    direction: 'horizontal',
    initialSplit: 40,
    minSize: 30,
    maxSize: 70,
    resizable: true,
  },
  render: (args: any) => ({
    props: args,
    template: `
      <div style="height: 600px; border: 1px solid var(--ft-border-color);">
        <app-split-pane
          [direction]="direction"
          [initialSplit]="initialSplit"
          [minSize]="minSize"
          [maxSize]="maxSize"
          [resizable]="resizable"
        >
          <div left-pane style="display: flex; flex-direction: column; height: 100%; background-color: var(--ft-surface-primary);">
            <div style="padding: 16px; border-bottom: 1px solid var(--ft-border-color);">
              <h3 style="margin: 0;">AI Chat</h3>
            </div>
            <div style="flex: 1; padding: 16px; overflow-y: auto;">
              <p>Message 1: Hello, how can I help you?</p>
              <p>Message 2: I want to build a dashboard.</p>
              <p>Message 3: Great! Let me help you with that.</p>
            </div>
            <div style="padding: 16px; border-top: 1px solid var(--ft-border-color);">
              <input type="text" placeholder="Type a message..." style="width: 100%; padding: 8px;" />
            </div>
          </div>
          <div right-pane style="padding: 20px; background-color: var(--ft-surface-secondary);">
            <h3>Preview Canvas</h3>
            <p>Your application preview will appear here...</p>
          </div>
        </app-split-pane>
      </div>
    `,
  }),
};
