import type { Meta, StoryObj } from '@storybook/angular';
import { DataTableComponent } from './data-table.component';

const COLUMNS = [
  { key: 'id',     label: 'ID' },
  { key: 'name',   label: 'Device Name' },
  { key: 'status', label: 'Status' },
  { key: 'region', label: 'Region' },
];

const DATA = Array.from({ length: 50 }, (_, i) => ({
  id: `DEV-${String(i + 1).padStart(3, '0')}`,
  name: `Device ${i + 1}`,
  status: ['online', 'offline', 'warning'][i % 3],
  region: ['APAC', 'EMEA', 'AMER'][i % 3],
}));

const meta: Meta<DataTableComponent> = {
  title: 'Components/Data Table',
  component: DataTableComponent,
  tags: ['autodocs'],
  argTypes: {
    sort:            { action: 'sort' },
    rowClick:        { action: 'rowClick' },
    selectionChange: { action: 'selectionChange' },
  },
};

export default meta;
type Story = StoryObj<DataTableComponent>;

export const Basic: Story = {
  args: {
    columns: COLUMNS,
    data: DATA.slice(0, 5),
    sortable: false,
    selectable: false,
  },
};

export const Sortable: Story = {
  args: {
    columns: COLUMNS,
    data: DATA.slice(0, 10),
    sortable: true,
    selectable: false,
    pageSize: 10,
  },
};

export const SelectableAndPaginated: Story = {
  args: {
    columns: COLUMNS,
    data: DATA,
    sortable: true,
    selectable: true,
    pageSize: 10,
  },
};
