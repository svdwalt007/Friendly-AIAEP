import type { Meta, StoryObj } from '@storybook/angular';
import { ComponentPickerComponent } from './component-picker.component';

const meta: Meta<ComponentPickerComponent> = {
  title: 'Components/Component Picker',
  component: ComponentPickerComponent,
  tags: ['autodocs'],
  argTypes: {
    components: {
      description: 'Array of component templates to display',
    },
    componentSelected: {
      action: 'componentSelected',
      description: 'Event emitted when a component is selected',
    },
    componentPreviewed: {
      action: 'componentPreviewed',
      description: 'Event emitted when a component is hovered',
    },
  },
  decorators: [
    (story: any) => ({
      template: `
        <div style="height: 600px; border: 1px solid var(--ft-border-color);">
          ${story}
        </div>
      `,
    }),
  ],
};

export default meta;
type Story = StoryObj<ComponentPickerComponent>;

export const Default: Story = {
  args: {},
};

export const WithCustomComponents: Story = {
  args: {
    components: [
      {
        id: 'custom-1',
        name: 'Custom Widget',
        description: 'A custom widget for displaying data',
        category: 'custom',
        icon: 'widgets',
        tags: ['custom', 'widget', 'data'],
      },
      {
        id: 'custom-2',
        name: 'Analytics Panel',
        description: 'Advanced analytics dashboard panel',
        category: 'data-display',
        icon: 'analytics',
        tags: ['analytics', 'dashboard', 'metrics'],
      },
      {
        id: 'custom-3',
        name: 'Device Control',
        description: 'IoT device control interface',
        category: 'iot',
        icon: 'settings_remote',
        tags: ['iot', 'control', 'device'],
      },
    ],
  },
};

export const AllCategories: Story = {
  args: {},
  play: async () => {
    // Story to showcase all component categories
  },
};

export const SearchExample: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Type in the search box to filter components by name, description, or tags.',
      },
    },
  },
};

export const InteractiveDemo: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Click on any component to select it. Hover over components to preview them.',
      },
    },
  },
};
