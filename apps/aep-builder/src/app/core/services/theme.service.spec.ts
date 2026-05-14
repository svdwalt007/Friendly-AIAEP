import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeService } from './theme.service';

function makeMatchMedia(matches = false): typeof window.matchMedia {
  return ((_query: string) => ({
    matches,
    media: _query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => true,
  })) as unknown as typeof window.matchMedia;
}

describe('ThemeService', () => {
  let svc: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('high-contrast', 'reduced-motion');
    vi.stubGlobal('matchMedia', makeMatchMedia(false));
    TestBed.configureTestingModule({ providers: [ThemeService] });
    svc = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('starts in light theme when no preference is stored', () => {
    expect(svc.theme()).toBe('light');
    expect(svc.isDark()).toBe(false);
  });

  it('toggle flips light <-> dark and persists', async () => {
    svc.toggle();
    expect(svc.theme()).toBe('dark');
    expect(svc.isDark()).toBe(true);
    svc.toggle();
    expect(svc.theme()).toBe('light');
    expect(localStorage.getItem('aep_theme')).toBe('light');
  });

  it('setTheme persists and sets data-theme on <html>', () => {
    svc.setTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('aep_theme')).toBe('dark');
  });

  it('updatePreferences merges + persists preferences', () => {
    svc.updatePreferences({ fontSize: 'large' });
    expect(svc.preferences().fontSize).toBe('large');
    const stored = JSON.parse(localStorage.getItem('aep_theme_preferences') ?? '{}');
    expect(stored.fontSize).toBe('large');
  });

  it('setHighContrast toggles the high-contrast class on <html>', () => {
    svc.setHighContrast(true);
    expect(document.documentElement.classList.contains('high-contrast')).toBe(
      true,
    );
    svc.setHighContrast(false);
    expect(document.documentElement.classList.contains('high-contrast')).toBe(
      false,
    );
  });

  it('setReducedMotion toggles the reduced-motion class on <html>', () => {
    svc.setReducedMotion(true);
    expect(document.documentElement.classList.contains('reduced-motion')).toBe(
      true,
    );
  });

  it('setFontSize updates the data-font-size attribute', () => {
    svc.setFontSize('small');
    expect(document.documentElement.getAttribute('data-font-size')).toBe('small');
  });

  it('setDesignToken writes a CSS variable, getDesignToken reads it', () => {
    svc.setDesignToken('test-token', '#123456');
    expect(svc.getDesignToken('test-token')).toBe('#123456');
  });

  it('resetToDefaults clears localStorage and reloads defaults', () => {
    svc.setTheme('dark');
    svc.updatePreferences({ fontSize: 'large' });
    svc.resetToDefaults();
    expect(localStorage.getItem('aep_theme')).toBeNull();
    expect(localStorage.getItem('aep_theme_preferences')).toBeNull();
    expect(svc.preferences().fontSize).toBe('medium');
  });

  it('loads malformed stored preferences as defaults', () => {
    localStorage.setItem('aep_theme_preferences', '{not json');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [ThemeService] });
    const fresh = TestBed.inject(ThemeService);
    expect(fresh.preferences().fontSize).toBe('medium');
  });

  it('honours system dark preference when nothing is stored', () => {
    vi.stubGlobal('matchMedia', makeMatchMedia(true));
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [ThemeService] });
    const fresh = TestBed.inject(ThemeService);
    expect(fresh.theme()).toBe('dark');
  });
});
