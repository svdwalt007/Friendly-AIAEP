import { Injectable, signal, computed, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'light' | 'dark';

export interface DesignToken {
  name: string;
  value: string;
  category: 'color' | 'spacing' | 'typography' | 'elevation' | 'radius' | 'transition';
}

export interface ThemePreferences {
  theme: Theme;
  highContrast: boolean;
  reducedMotion: boolean;
  fontSize: 'small' | 'medium' | 'large';
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'aep_theme';
  private readonly PREFERENCES_KEY = 'aep_theme_preferences';
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private themeSignal = signal<Theme>(this.loadTheme());
  private preferencesSignal = signal<ThemePreferences>(this.loadPreferences());

  readonly theme = this.themeSignal.asReadonly();
  readonly isDark = computed(() => this.themeSignal() === 'dark');
  readonly preferences = this.preferencesSignal.asReadonly();

  constructor() {
    effect(() => {
      const theme = this.themeSignal();
      if (this.isBrowser) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(this.STORAGE_KEY, theme);
      }
    });

    effect(() => {
      const prefs = this.preferencesSignal();
      if (this.isBrowser) {
        this.applyPreferences(prefs);
        localStorage.setItem(this.PREFERENCES_KEY, JSON.stringify(prefs));
      }
    });

    // Listen for system theme changes
    if (this.isBrowser) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (!stored) {
          this.themeSignal.set(e.matches ? 'dark' : 'light');
        }
      });
    }
  }

  toggle(): void {
    this.themeSignal.update((current) => (current === 'light' ? 'dark' : 'light'));
  }

  setTheme(theme: Theme): void {
    this.themeSignal.set(theme);
  }

  updatePreferences(preferences: Partial<ThemePreferences>): void {
    this.preferencesSignal.update((current) => ({ ...current, ...preferences }));
  }

  setHighContrast(enabled: boolean): void {
    this.updatePreferences({ highContrast: enabled });
  }

  setReducedMotion(enabled: boolean): void {
    this.updatePreferences({ reducedMotion: enabled });
  }

  setFontSize(size: 'small' | 'medium' | 'large'): void {
    this.updatePreferences({ fontSize: size });
  }

  getDesignToken(tokenName: string): string {
    if (!this.isBrowser) return '';
    const value = getComputedStyle(document.documentElement).getPropertyValue(`--ft-${tokenName}`);
    return value.trim();
  }

  setDesignToken(tokenName: string, value: string): void {
    if (!this.isBrowser) return;
    document.documentElement.style.setProperty(`--ft-${tokenName}`, value);
  }

  getAllDesignTokens(): DesignToken[] {
    if (!this.isBrowser) return [];

    const tokens: DesignToken[] = [];
    const styles = getComputedStyle(document.documentElement);
    const tokenPrefix = '--ft-';

    // Get all CSS variables
    for (let i = 0; i < document.styleSheets.length; i++) {
      try {
        const styleSheet = document.styleSheets[i];
        if (!styleSheet.cssRules) continue;

        for (let j = 0; j < styleSheet.cssRules.length; j++) {
          const rule = styleSheet.cssRules[j] as CSSStyleRule;
          if (rule.selectorText === ':root' || rule.selectorText?.includes('[data-theme')) {
            const style = rule.style;
            for (let k = 0; k < style.length; k++) {
              const prop = style[k];
              if (prop.startsWith(tokenPrefix)) {
                const name = prop.substring(tokenPrefix.length);
                const value = styles.getPropertyValue(prop).trim();
                const category = this.categorizeToken(name);

                if (!tokens.find((t) => t.name === name)) {
                  tokens.push({ name, value, category });
                }
              }
            }
          }
        }
      } catch (e) {
        // Skip inaccessible stylesheets (CORS)
        continue;
      }
    }

    return tokens;
  }

  resetToDefaults(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.PREFERENCES_KEY);
    this.themeSignal.set(this.loadTheme());
    this.preferencesSignal.set(this.getDefaultPreferences());
  }

  private loadTheme(): Theme {
    if (this.isBrowser) {
      const stored = localStorage.getItem(this.STORAGE_KEY) as Theme | null;
      if (stored) return stored;
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    }
    return 'light';
  }

  private loadPreferences(): ThemePreferences {
    if (this.isBrowser) {
      const stored = localStorage.getItem(this.PREFERENCES_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return this.getDefaultPreferences();
        }
      }
    }
    return this.getDefaultPreferences();
  }

  private getDefaultPreferences(): ThemePreferences {
    return {
      theme: this.loadTheme(),
      highContrast: false,
      reducedMotion: this.isBrowser
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false,
      fontSize: 'medium',
    };
  }

  private applyPreferences(prefs: ThemePreferences): void {
    if (!this.isBrowser) return;

    // Update theme
    this.themeSignal.set(prefs.theme);

    // Apply high contrast
    if (prefs.highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }

    // Apply reduced motion
    if (prefs.reducedMotion) {
      document.documentElement.classList.add('reduced-motion');
    } else {
      document.documentElement.classList.remove('reduced-motion');
    }

    // Apply font size
    document.documentElement.setAttribute('data-font-size', prefs.fontSize);
  }

  private categorizeToken(
    name: string
  ): 'color' | 'spacing' | 'typography' | 'elevation' | 'radius' | 'transition' {
    if (
      name.includes('color') ||
      name.includes('primary') ||
      name.includes('accent') ||
      name.includes('surface') ||
      name.includes('text') ||
      name.includes('border') ||
      name.includes('success') ||
      name.includes('warning') ||
      name.includes('error') ||
      name.includes('info')
    ) {
      return 'color';
    }
    if (name.includes('spacing') || name.includes('gutter')) {
      return 'spacing';
    }
    if (
      name.includes('font') ||
      name.includes('line-height') ||
      name.includes('letter-spacing')
    ) {
      return 'typography';
    }
    if (name.includes('elevation') || name.includes('shadow')) {
      return 'elevation';
    }
    if (name.includes('radius')) {
      return 'radius';
    }
    if (name.includes('transition') || name.includes('ease')) {
      return 'transition';
    }
    return 'color';
  }
}
