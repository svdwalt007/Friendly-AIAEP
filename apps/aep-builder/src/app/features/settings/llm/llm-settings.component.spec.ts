import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LlmSettingsComponent } from './llm-settings.component';

describe('LlmSettingsComponent', () => {
  let component: LlmSettingsComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LlmSettingsComponent],
      providers: [provideNoopAnimations()],
    });
    component = TestBed.createComponent(LlmSettingsComponent).componentInstance;
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with the anthropic provider preselected', () => {
    expect(component.form.get('provider')?.value).toBe('anthropic');
    expect(component.connectionStatus()).toBe('idle');
  });

  it('availableModels reflects the selected provider', () => {
    component.form.patchValue({ provider: 'openai' });
    expect(component.availableModels()).toContain('gpt-4o');
    component.form.patchValue({ provider: 'ollama' });
    expect(component.availableModels()).toContain('llama3.2');
  });

  it('onProviderChange resets model + connection status', () => {
    component.form.patchValue({ provider: 'openai' });
    component.connectionStatus.set('ok');
    component.onProviderChange();
    expect(component.form.get('model')?.value).toBe('gpt-4o');
    expect(component.connectionStatus()).toBe('idle');
  });

  it('testConnection no-ops when form is invalid', () => {
    vi.useFakeTimers();
    component.connectionStatus.set('idle');
    // apiKey is required and empty by default → invalid
    component.testConnection();
    expect(component.connectionStatus()).toBe('idle');
  });

  it('testConnection sets ok when the simulated roll succeeds', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    component.form.patchValue({ apiKey: 'sk-test' });
    component.testConnection();
    expect(component.connectionStatus()).toBe('testing');
    vi.advanceTimersByTime(1500);
    expect(component.connectionStatus()).toBe('ok');
  });

  it('testConnection sets error when the simulated roll fails', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    component.form.patchValue({ apiKey: 'sk-test' });
    component.testConnection();
    vi.advanceTimersByTime(1500);
    expect(component.connectionStatus()).toBe('error');
  });

  it('saveSettings persists form values when valid', () => {
    component.form.patchValue({ apiKey: 'sk-test' });
    component.saveSettings();
    const stored = JSON.parse(localStorage.getItem('aep_llm_settings') ?? '{}');
    expect(stored.provider).toBe('anthropic');
    expect(stored.apiKey).toBe('sk-test');
  });

  it('saveSettings does not persist when form is invalid', () => {
    component.saveSettings();
    expect(localStorage.getItem('aep_llm_settings')).toBeNull();
  });

  it('statusIcon / statusClass reflect the current status', () => {
    component.connectionStatus.set('ok');
    expect(component.statusIcon()).toBe('check_circle');
    expect(component.statusClass()).toBe('status-ok');
    component.connectionStatus.set('error');
    expect(component.statusIcon()).toBe('error');
    expect(component.statusClass()).toBe('status-error');
    component.connectionStatus.set('idle');
    expect(component.statusIcon()).toBeNull();
    expect(component.statusClass()).toBe('');
  });

  it('temperatureDisplay formats to two decimals', () => {
    component.form.patchValue({ temperature: 0.5 });
    expect(component.temperatureDisplay()).toBe('0.50');
    component.form.patchValue({ temperature: null });
    expect(component.temperatureDisplay()).toBe('0.70');
  });

  it('formatTemperature returns 2-decimal string', () => {
    expect(component.formatTemperature(0.333)).toBe('0.33');
  });

  it('isTesting tracks the testing status', () => {
    component.connectionStatus.set('testing');
    expect(component.isTesting()).toBe(true);
    component.connectionStatus.set('idle');
    expect(component.isTesting()).toBe(false);
  });
});
