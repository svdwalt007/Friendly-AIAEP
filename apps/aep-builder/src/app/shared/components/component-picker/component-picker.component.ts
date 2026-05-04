import { Component, EventEmitter, Input, Output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface ComponentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  tags: string[];
  preview?: string;
  code?: string;
}

export type ComponentCategory =
  | 'layout'
  | 'data-display'
  | 'forms'
  | 'navigation'
  | 'feedback'
  | 'charts'
  | 'iot'
  | 'custom';

@Component({
  selector: 'app-component-picker',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatChipsModule,
    MatTooltipModule,
  ],
  templateUrl: './component-picker.component.html',
  styleUrl: './component-picker.component.scss',
})
export class ComponentPickerComponent {
  @Input() set components(value: ComponentTemplate[]) {
    this.componentsSignal.set(value);
  }

  @Output() componentSelected = new EventEmitter<ComponentTemplate>();
  @Output() componentPreviewed = new EventEmitter<ComponentTemplate>();

  // Signal with different name to avoid conflict with setter
  protected readonly componentsSignal = signal<ComponentTemplate[]>(this.getDefaultComponents());
  searchQuery = signal('');
  private selectedCategory = signal<ComponentCategory | 'all'>('all');

  readonly categories: Array<{ id: ComponentCategory | 'all'; label: string; icon: string }> = [
    { id: 'all', label: 'All Components', icon: 'grid_view' },
    { id: 'layout', label: 'Layout', icon: 'view_quilt' },
    { id: 'data-display', label: 'Data Display', icon: 'table_chart' },
    { id: 'forms', label: 'Forms', icon: 'edit_note' },
    { id: 'navigation', label: 'Navigation', icon: 'menu' },
    { id: 'feedback', label: 'Feedback', icon: 'notifications' },
    { id: 'charts', label: 'Charts', icon: 'show_chart' },
    { id: 'iot', label: 'IoT Components', icon: 'sensors' },
    { id: 'custom', label: 'Custom', icon: 'extension' },
  ];

  readonly filteredComponents = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const category = this.selectedCategory();
    const components = this.componentsSignal();

    return components.filter((component) => {
      const matchesSearch =
        !query ||
        component.name.toLowerCase().includes(query) ||
        component.description.toLowerCase().includes(query) ||
        component.tags.some((tag) => tag.toLowerCase().includes(query));

      const matchesCategory = category === 'all' || component.category === category;

      return matchesSearch && matchesCategory;
    });
  });

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
  }

  onCategorySelect(category: ComponentCategory | 'all'): void {
    this.selectedCategory.set(category);
  }

  isSelectedCategory(category: ComponentCategory | 'all'): boolean {
    return this.selectedCategory() === category;
  }

  onComponentClick(component: ComponentTemplate): void {
    this.componentSelected.emit(component);
  }

  onComponentHover(component: ComponentTemplate): void {
    this.componentPreviewed.emit(component);
  }

  getCategoryIcon(category: string): string {
    const cat = this.categories.find((c) => c.id === category);
    return cat?.icon || 'extension';
  }

  private getDefaultComponents(): ComponentTemplate[] {
    return [
      {
        id: 'dashboard',
        name: 'Dashboard Layout',
        description: 'Responsive dashboard with sidebar and header',
        category: 'layout',
        icon: 'dashboard',
        tags: ['layout', 'responsive', 'navigation'],
      },
      {
        id: 'data-table',
        name: 'Data Table',
        description: 'Sortable, filterable data table with pagination',
        category: 'data-display',
        icon: 'table_view',
        tags: ['table', 'data', 'pagination', 'sort'],
      },
      {
        id: 'device-card',
        name: 'IoT Device Card',
        description: 'Card showing device status and metrics',
        category: 'iot',
        icon: 'devices',
        tags: ['iot', 'device', 'status', 'card'],
      },
      {
        id: 'sensor-chart',
        name: 'Sensor Data Chart',
        description: 'Real-time line chart for sensor readings',
        category: 'charts',
        icon: 'show_chart',
        tags: ['chart', 'sensor', 'real-time', 'iot'],
      },
      {
        id: 'form-builder',
        name: 'Dynamic Form',
        description: 'Dynamic form with validation',
        category: 'forms',
        icon: 'dynamic_form',
        tags: ['form', 'validation', 'input'],
      },
      {
        id: 'sidebar-nav',
        name: 'Sidebar Navigation',
        description: 'Collapsible sidebar with nested menu items',
        category: 'navigation',
        icon: 'menu',
        tags: ['navigation', 'sidebar', 'menu'],
      },
      {
        id: 'notification-center',
        name: 'Notification Center',
        description: 'Toast notifications and notification panel',
        category: 'feedback',
        icon: 'notifications_active',
        tags: ['notifications', 'toast', 'alerts'],
      },
      {
        id: 'gauge-widget',
        name: 'Gauge Widget',
        description: 'Circular gauge for displaying metrics',
        category: 'charts',
        icon: 'speed',
        tags: ['gauge', 'metric', 'chart', 'widget'],
      },
      {
        id: 'map-view',
        name: 'Device Map',
        description: 'Interactive map showing device locations',
        category: 'iot',
        icon: 'map',
        tags: ['map', 'location', 'devices', 'iot'],
      },
      {
        id: 'timeline',
        name: 'Event Timeline',
        description: 'Chronological timeline of events',
        category: 'data-display',
        icon: 'timeline',
        tags: ['timeline', 'events', 'history'],
      },
      {
        id: 'stats-grid',
        name: 'Statistics Grid',
        description: 'Grid of KPI cards with trend indicators',
        category: 'data-display',
        icon: 'analytics',
        tags: ['stats', 'kpi', 'metrics', 'grid'],
      },
      {
        id: 'alert-panel',
        name: 'Alert Panel',
        description: 'Panel showing active alerts and warnings',
        category: 'iot',
        icon: 'warning',
        tags: ['alerts', 'warnings', 'iot', 'monitoring'],
      },
    ];
  }
}
