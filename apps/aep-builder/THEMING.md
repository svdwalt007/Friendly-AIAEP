# Friendly AEP Builder - Theming System

This document describes the custom Angular Material 3 theme implementation for the AEP Builder application.

## Overview

The theming system is built on Angular Material 3 (v21+) and implements Friendly Technology's brand guidelines with:

- **Primary Color**: Navy (#12174C)
- **Accent Color**: Orange (#FF5900)
- **Secondary Color**: Charcoal (#59585A)
- **Typography**: Calibri (fallback to Roboto, sans-serif)
- **Design Pattern**: Data-dense tables and portal-style UI matching existing Friendly applications

## File Structure

```
apps/aep-builder/src/styles/
├── variables.scss          # CSS custom properties and brand tokens
├── theme.scss             # Angular Material 3 theme configuration
├── friendly-design.scss   # Utility classes and custom components
└── [imported by] ../styles.scss
```

## Theme Files

### 1. variables.scss

Defines all CSS custom properties (CSS variables) used throughout the application:

- **Colors**: Primary, accent, semantic colors, text colors, surfaces
- **Spacing**: 8px-based spacing scale (xs to 3xl)
- **Typography**: Font families, sizes, weights, line heights
- **Shadows**: Elevation levels from xs to 2xl
- **Borders**: Radius values and colors
- **Z-index**: Stacking context layers
- **Transitions**: Duration and easing functions
- **Component Tokens**: Cards, tables, buttons, inputs

**Dark Mode**: Automatically overrides colors when `data-theme="dark"` is applied to any element.

### 2. theme.scss

Implements Angular Material 3 theming system:

- **Custom Palettes**: Material color palettes for primary (navy), accent (orange), and secondary (charcoal)
- **Typography Config**: Custom typography using Calibri font family
- **Light Theme**: Default theme using light surface colors
- **Dark Theme**: Alternative theme for dark mode
- **Component Customizations**: Material component overrides to match Friendly design patterns

### 3. friendly-design.scss

Provides utility classes and reusable patterns:

- **Background/Text Utilities**: `.ft-navy-bg`, `.ft-orange-accent`, etc.
- **Card Components**: `.ft-card`, `.ft-card-header`, `.ft-card-elevated`
- **Data Tables**: `.ft-data-table` with striped, bordered, and compact variants
- **Buttons**: `.ft-btn-primary`, `.ft-btn-accent`, `.ft-btn-outline`
- **Form Elements**: `.ft-input`, `.ft-label`, `.ft-form-group`
- **Spacing/Layout**: Margin, padding, flexbox, grid utilities
- **Portal Patterns**: `.ft-header-bar`, `.ft-metric-card`, `.ft-dashboard-grid`

## Usage Examples

### Using Angular Material Components

```typescript
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-example',
  standalone: true,
  imports: [MatButtonModule, MatCardModule],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Example Card</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <p>Material components automatically use the Friendly theme.</p>
      </mat-card-content>
      <mat-card-actions>
        <button mat-raised-button color="primary">Primary Action</button>
        <button mat-button color="accent">Secondary Action</button>
      </mat-card-actions>
    </mat-card>
  `
})
export class ExampleComponent {}
```

### Using Friendly Design Utilities

```html
<!-- Card with Friendly styling -->
<div class="ft-card">
  <div class="ft-card-header">
    <h2>Dashboard</h2>
    <button class="ft-btn ft-btn-accent">New Project</button>
  </div>
  <div class="ft-card-body">
    <!-- Content here -->
  </div>
</div>

<!-- Data-dense table -->
<table class="ft-data-table ft-striped ft-compact">
  <thead>
    <tr>
      <th>Project Name</th>
      <th>Status</th>
      <th>Last Updated</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Project Alpha</td>
      <td><span class="ft-status-badge status-active">Active</span></td>
      <td>2024-04-11</td>
      <td class="ft-table-actions">
        <button class="ft-btn ft-btn-sm ft-btn-primary">Edit</button>
      </td>
    </tr>
  </tbody>
</table>

<!-- Metric card -->
<div class="ft-metric-card">
  <div class="metric-label">Total Projects</div>
  <div class="metric-value">127</div>
  <div class="metric-change positive">+12% this month</div>
</div>
```

### Using CSS Custom Properties

```css
/* In your component styles */
.my-component {
  background-color: var(--ft-surface-primary);
  color: var(--ft-text-primary);
  padding: var(--ft-spacing-lg);
  border-radius: var(--ft-radius-md);
  box-shadow: var(--ft-shadow-md);
}

.my-button {
  background-color: var(--ft-accent);
  color: var(--ft-text-light);
  transition: background-color var(--ft-transition-base);
}

.my-button:hover {
  background-color: #ff6b1a; /* Lighter orange */
}
```

### Dark Mode Implementation

Enable dark mode by adding the `data-theme="dark"` attribute:

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <div [attr.data-theme]="isDarkMode ? 'dark' : null">
      <!-- Your app content -->
      <button (click)="toggleTheme()">Toggle Theme</button>
    </div>
  `
})
export class AppComponent {
  isDarkMode = false;

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
  }
}
```

Or apply to the document root:

```typescript
import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';

export class ThemeService {
  private document = inject(DOCUMENT);

  setDarkMode(enabled: boolean) {
    if (enabled) {
      this.document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      this.document.documentElement.removeAttribute('data-theme');
    }
  }
}
```

## Material Component Examples

### Buttons

```html
<!-- Material buttons (automatically themed) -->
<button mat-button>Basic Button</button>
<button mat-raised-button color="primary">Primary Raised</button>
<button mat-flat-button color="accent">Accent Flat</button>
<button mat-stroked-button>Outlined Button</button>
<button mat-icon-button><mat-icon>favorite</mat-icon></button>
<button mat-fab color="accent"><mat-icon>add</mat-icon></button>
```

### Forms

```html
<mat-form-field appearance="outline">
  <mat-label>Project Name</mat-label>
  <input matInput placeholder="Enter project name">
  <mat-hint>Choose a unique name</mat-hint>
</mat-form-field>

<mat-form-field appearance="fill">
  <mat-label>Description</mat-label>
  <textarea matInput rows="4"></textarea>
</mat-form-field>
```

### Data Tables (Material)

```typescript
import { MatTableModule } from '@angular/material/table';

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [MatTableModule],
  template: `
    <div class="ft-dense-table">
      <table mat-table [dataSource]="dataSource">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Name</th>
          <td mat-cell *matCellDef="let row">{{row.name}}</td>
        </ng-container>
        <!-- More columns... -->
        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
      </table>
    </div>
  `
})
export class DataTableComponent {
  displayedColumns = ['name', 'status', 'date'];
  dataSource = [...]; // Your data
}
```

## Utility Class Reference

### Colors

- `.ft-navy-bg`, `.ft-orange-bg`, `.ft-charcoal-bg` - Background colors
- `.ft-navy-text`, `.ft-orange-text`, `.ft-orange-accent` - Text colors
- `.ft-text-muted`, `.ft-text-disabled` - Semantic text colors

### Spacing

- `.ft-mt-{size}`, `.ft-mb-{size}` - Margin top/bottom (0, xs, sm, md, lg, xl)
- `.ft-p-{size}` - Padding (0, xs, sm, md, lg, xl)
- `.ft-gap-{size}` - Gap for flexbox/grid (xs, sm, md, lg, xl)

### Layout

- `.ft-flex`, `.ft-flex-column`, `.ft-flex-wrap` - Flexbox
- `.ft-justify-{value}`, `.ft-align-{value}` - Flex alignment
- `.ft-grid`, `.ft-grid-cols-{n}` - Grid layouts (2, 3, 4 columns)

### Elevation

- `.ft-elevation-{level}` - Box shadows (0-5)

### Borders

- `.ft-border`, `.ft-border-top`, `.ft-border-bottom` - Borders
- `.ft-border-accent`, `.ft-border-thick` - Border variations

## SCSS Mixins

Available mixins in `variables.scss`:

```scss
@use '../styles/variables' as vars;

.my-component {
  // Add elevation
  @include vars.ft-elevation(2);

  // Add transition
  @include vars.ft-transition(all, fast);

  // Truncate text
  @include vars.ft-truncate;

  // Responsive breakpoints
  @include vars.ft-breakpoint(md) {
    width: 50%;
  }
}
```

## Best Practices

1. **Use CSS Custom Properties**: Prefer `var(--ft-primary)` over hardcoded colors
2. **Leverage Material Components**: Use Angular Material components when possible
3. **Apply Utility Classes**: Use `.ft-*` utilities for consistency
4. **Maintain Accessibility**: Ensure proper contrast ratios and keyboard navigation
5. **Test Both Themes**: Verify components work in light and dark modes
6. **Follow Friendly Patterns**: Use data-dense tables and portal-style layouts
7. **Responsive Design**: Use the provided breakpoint mixins

## Component-Specific Notes

### Tables

For data-dense tables matching Friendly portal style:
- Use `.ft-data-table` for custom HTML tables
- Use `.ft-dense-table` wrapper with Material tables
- Add `.ft-compact` for even denser spacing
- Add `.ft-striped` for alternating row colors

### Cards

For portal-style cards:
- Use `.ft-card` with `.ft-card-header`, `.ft-card-body`, `.ft-card-footer`
- Add `.ft-card-elevated` for higher elevation
- Add `.ft-card-compact` for reduced padding

### Buttons

- Primary actions: Use `mat-raised-button` with `color="primary"` or `.ft-btn-primary`
- Secondary actions: Use `mat-button` or `.ft-btn-secondary`
- CTAs: Use `color="accent"` or `.ft-btn-accent`

## Browser Support

The theme supports all modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

CSS custom properties require modern browsers (no IE11 support).

## Further Customization

To customize the theme:

1. **Update Brand Colors**: Edit color values in `variables.scss`
2. **Modify Palettes**: Adjust Material palettes in `theme.scss`
3. **Add Utilities**: Extend `friendly-design.scss` with new classes
4. **Component Overrides**: Add Material component customizations to `theme.scss`

## Resources

- [Angular Material Documentation](https://material.angular.io)
- [Material Design 3 Guidelines](https://m3.material.io)
- [Friendly Brand Guidelines](../../../docs/) (see project docs)
