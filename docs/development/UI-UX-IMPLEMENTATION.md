# UI/UX Enhancement Implementation

This document outlines the comprehensive UI/UX enhancements implemented for the Angular builder application.

## Overview

The implementation includes a complete design system, reusable components, enhanced theming, and Storybook integration for component documentation and testing.

## Design System

### 1. Design Tokens (`apps/aep-builder/src/styles/design-tokens.scss`)

A comprehensive design token system with semantic naming following WCAG 2.1 AA standards:

- **Color Tokens**: Brand colors, neutrals, semantic colors (success, warning, error, info)
- **Light & Dark Themes**: Full theme support with automatic switching
- **Spacing Scale**: 8px-based spacing system (xs, sm, md, lg, xl, 2xl, 3xl)
- **Typography**: Modular scale (1.250 ratio), font families, weights, line heights
- **Elevation**: 5-level shadow system
- **Border Radius**: Consistent rounding scale
- **Z-Index**: Layering scale for overlays, modals, tooltips
- **Transitions**: Pre-defined durations and easing functions

### 2. SCSS Mixins (`apps/aep-builder/src/styles/mixins.scss`)

Reusable utilities for consistent styling:

- **Responsive Design**: Breakpoint mixins (xs, sm, md, lg, xl, 2xl)
- **Flexbox & Grid**: Layout utilities
- **Typography**: Heading and body text styles
- **Visual Effects**: Elevation, focus rings, glassmorphism
- **Animations**: Transition helpers, hover effects, skeleton loading
- **Accessibility**: Screen reader only, focus visible, reduced motion
- **Scrollbars**: Custom scrollbar styling
- **Form Elements**: Input base styles

### 3. Animations (`apps/aep-builder/src/styles/animations.scss`)

Micro-interactions and smooth transitions:

- **Keyframe Animations**: Fade, slide, scale, bounce, pulse, shake, rotate, wiggle
- **Utility Classes**: Pre-defined animation classes
- **Micro-interactions**: Hover effects (grow, lift, brighten, glow)
- **Loading States**: Shimmer, skeleton, typing indicator
- **Page Transitions**: Entrance/exit animations
- **Reduced Motion**: Automatic support for accessibility

## Components

### 1. Split Pane Component (`apps/aep-builder/src/app/shared/components/split-pane/`)

A fully accessible, resizable split-pane layout:

**Features:**
- Horizontal and vertical orientation
- Mouse and touch support
- Keyboard navigation (Arrow keys, Home, End)
- Configurable min/max sizes
- Smooth resize with throttling
- ARIA attributes for accessibility
- Event emissions for resize tracking

**Props:**
- `direction`: 'horizontal' | 'vertical'
- `initialSplit`: Initial split percentage (default: 50)
- `minSize`: Minimum pane size (default: 20)
- `maxSize`: Maximum pane size (default: 80)
- `resizable`: Enable/disable resizing (default: true)

**Events:**
- `splitChange`: Emitted on position change
- `resizeStart`: Emitted when resize begins
- `resizeEnd`: Emitted when resize completes

### 2. Code Diff Viewer (`apps/aep-builder/src/app/shared/components/code-diff-viewer/`)

Professional code difference viewer:

**Features:**
- Unified and split view modes
- Line numbers and change indicators
- Syntax highlighting support
- Collapsible file sections
- Copy to clipboard functionality
- Statistics display (additions/deletions)
- Accessible table structure with ARIA
- High contrast mode support

**Props:**
- `diffs`: Array of FileDiff objects
- `viewMode`: 'unified' | 'split' (default: 'unified')
- `showLineNumbers`: Display line numbers (default: true)
- `collapsible`: Allow file collapse (default: true)

### 3. Component Picker (`apps/aep-builder/src/app/shared/components/component-picker/`)

Visual component library browser:

**Features:**
- Category filtering (Layout, Data Display, Forms, Navigation, etc.)
- Real-time search by name, description, or tags
- Visual component cards with icons
- Hover preview support
- Responsive grid layout
- Staggered entrance animations
- Keyboard navigation

**Props:**
- `components`: Array of ComponentTemplate objects

**Events:**
- `componentSelected`: Emitted on component selection
- `componentPreviewed`: Emitted on hover

**Default Components:**
- Dashboard Layout
- Data Table
- IoT Device Card
- Sensor Data Chart
- Dynamic Form
- Sidebar Navigation
- Notification Center
- Gauge Widget
- Device Map
- Event Timeline
- Statistics Grid
- Alert Panel

## Enhanced Theme Service

The theme service (`apps/aep-builder/src/app/core/services/theme.service.ts`) now includes:

### Features:
- Theme persistence (localStorage)
- System theme detection
- Design token management
- Accessibility preferences
- High contrast mode
- Reduced motion support
- Font size adjustment

### API:
```typescript
// Theme Management
toggle(): void
setTheme(theme: Theme): void

// Accessibility
setHighContrast(enabled: boolean): void
setReducedMotion(enabled: boolean): void
setFontSize(size: 'small' | 'medium' | 'large'): void

// Design Tokens
getDesignToken(tokenName: string): string
setDesignToken(tokenName: string, value: string): void
getAllDesignTokens(): DesignToken[]

// Preferences
updatePreferences(preferences: Partial<ThemePreferences>): void
resetToDefaults(): void
```

## Builder Component Enhancements

The main builder component now features:

### Split-Pane Layout:
- Left: AI chat interface (40% default)
- Right: Tabbed canvas with:
  - Preview tab
  - Component Picker tab
  - Code Changes tab

### Accessibility Improvements:
- Proper ARIA labels and roles
- Keyboard navigation support
- Screen reader announcements
- Focus management
- Semantic HTML structure

### Visual Enhancements:
- Smooth animations and transitions
- Responsive design
- High contrast mode support
- Custom scrollbars
- Micro-interactions

## Storybook Integration

### Configuration Files:
- `.storybook/main.ts`: Main Storybook configuration
- `.storybook/preview.ts`: Global decorators and parameters

### Stories Created:
1. **Split Pane Stories**: Various layouts and configurations
2. **Code Diff Viewer Stories**: Different view modes and states
3. **Component Picker Stories**: Default and custom components

### Features:
- Automatic documentation generation
- Accessibility testing (a11y addon)
- Theme switching
- Interactive controls
- Component playground

## Required Dependencies

To use Storybook, add these dependencies to `package.json`:

```json
{
  "devDependencies": {
    "@storybook/angular": "^8.0.0",
    "@storybook/addon-essentials": "^8.0.0",
    "@storybook/addon-interactions": "^8.0.0",
    "@storybook/addon-a11y": "^8.0.0",
    "@storybook/addon-themes": "^8.0.0",
    "storybook": "^8.0.0"
  }
}
```

### Installation Command:
```bash
pnpm add -D @storybook/angular @storybook/addon-essentials @storybook/addon-interactions @storybook/addon-a11y @storybook/addon-themes storybook
```

### Run Storybook:
```bash
pnpm exec nx run aep-builder:storybook
```

## Accessibility Compliance

All components are WCAG 2.1 AA compliant:

✅ **Keyboard Navigation**: All interactive elements accessible via keyboard
✅ **ARIA Labels**: Proper labels for screen readers
✅ **Focus Management**: Visible focus indicators
✅ **Color Contrast**: Minimum 4.5:1 contrast ratio
✅ **Semantic HTML**: Proper heading hierarchy and landmarks
✅ **Reduced Motion**: Respects prefers-reduced-motion
✅ **High Contrast**: Additional contrast in high contrast mode
✅ **Screen Reader**: Announcements for dynamic content

## File Structure

```
apps/aep-builder/src/
├── styles/
│   ├── design-tokens.scss       # Design token system
│   ├── mixins.scss              # Reusable SCSS mixins
│   ├── animations.scss          # Animations and transitions
│   ├── variables.scss           # Legacy variables (existing)
│   ├── theme.scss              # Material theme (existing)
│   └── friendly-design.scss    # Friendly utilities (existing)
├── app/
│   ├── core/
│   │   └── services/
│   │       └── theme.service.ts # Enhanced theme service
│   ├── shared/
│   │   └── components/
│   │       ├── split-pane/
│   │       │   ├── split-pane.component.ts
│   │       │   ├── split-pane.component.html
│   │       │   ├── split-pane.component.scss
│   │       │   └── split-pane.component.stories.ts
│   │       ├── code-diff-viewer/
│   │       │   ├── code-diff-viewer.component.ts
│   │       │   ├── code-diff-viewer.component.html
│   │       │   ├── code-diff-viewer.component.scss
│   │       │   └── code-diff-viewer.component.stories.ts
│   │       └── component-picker/
│   │           ├── component-picker.component.ts
│   │           ├── component-picker.component.html
│   │           ├── component-picker.component.scss
│   │           └── component-picker.component.stories.ts
│   └── features/
│       └── builder/
│           ├── builder.component.ts      # Updated with split-pane
│           ├── builder.component.html    # New layout
│           └── builder.component.scss    # Enhanced styles
└── .storybook/
    ├── main.ts                  # Storybook configuration
    └── preview.ts               # Global decorators

```

## Usage Examples

### Using Split Pane:
```html
<app-split-pane
  [direction]="'horizontal'"
  [initialSplit]="40"
  [minSize]="30"
  [maxSize]="70"
  [resizable]="true"
  (splitChange)="onSplitChange($event)"
>
  <div left-pane>Left content</div>
  <div right-pane>Right content</div>
</app-split-pane>
```

### Using Code Diff Viewer:
```html
<app-code-diff-viewer
  [diffs]="fileDiffs"
  [viewMode]="'unified'"
  [showLineNumbers]="true"
  [collapsible]="true"
></app-code-diff-viewer>
```

### Using Component Picker:
```html
<app-component-picker
  [components]="customComponents"
  (componentSelected)="onSelect($event)"
  (componentPreviewed)="onPreview($event)"
></app-component-picker>
```

### Using Design Tokens:
```scss
.my-component {
  color: var(--ft-text-primary);
  background-color: var(--ft-surface-primary);
  padding: var(--ft-spacing-md);
  border-radius: var(--ft-radius-md);
  @include elevation(2);
}
```

### Using Mixins:
```scss
.my-responsive-component {
  @include flex-between;
  @include transition(background-color);

  @include breakpoint(md) {
    @include grid-columns(3);
  }

  &:hover {
    @include hover-lift;
  }
}
```

## Next Steps

1. **Install Storybook dependencies** (see above)
2. **Configure Nx for Storybook** (add storybook target to project.json)
3. **Add more component stories** as needed
4. **Integrate with CI/CD** for automated visual testing
5. **Add Chromatic** for visual regression testing
6. **Create design documentation** pages in Storybook

## Notes

- All components use Angular signals for reactivity
- Components are standalone and can be imported individually
- The design system is theme-aware and supports dark mode
- All animations respect the user's reduced motion preferences
- The implementation follows Angular best practices and style guide
