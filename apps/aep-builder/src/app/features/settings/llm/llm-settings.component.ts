/**
 * @file LLM Settings — B5 workspace surface.
 * Child route: /settings/llm
 * Provider, model, temperature, max tokens, connection test.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { Component, signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';

export type LLMProvider = 'openai' | 'anthropic' | 'ollama';

interface ProviderOption {
  value: LLMProvider;
  label: string;
  icon: string;
  models: string[];
}

const PROVIDERS: ProviderOption[] = [
  {
    value: 'openai',
    label: 'OpenAI',
    icon: 'auto_awesome',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  {
    value: 'anthropic',
    label: 'Anthropic',
    icon: 'psychology',
    models: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-3-5'],
  },
  {
    value: 'ollama',
    label: 'Ollama (local)',
    icon: 'computer',
    models: ['llama3.2', 'mistral', 'phi4', 'gemma3', 'qwen2.5-coder'],
  },
];

type ConnectionStatus = 'idle' | 'testing' | 'ok' | 'error';

@Component({
  selector: 'app-llm-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSliderModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  templateUrl: './llm-settings.component.html',
  styleUrl: './llm-settings.component.scss',
})
export class LlmSettingsComponent {
  private readonly fb = new FormBuilder();

  readonly providers = PROVIDERS;
  readonly connectionStatus = signal<ConnectionStatus>('idle');

  readonly form = this.fb.group({
    provider:     ['anthropic' as LLMProvider, Validators.required],
    model:        ['claude-sonnet-4-5', Validators.required],
    apiKey:       ['', Validators.required],
    baseUrl:      [''],
    temperature:  [0.7, [Validators.required, Validators.min(0), Validators.max(1)]],
    maxTokens:    [4096, [Validators.required, Validators.min(1), Validators.max(128000)]],
  });

  // Bridge reactive-form values into the signal graph so downstream
  // `computed()`s react to patchValue / user edits without manual ticks.
  private readonly formValues = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  readonly availableModels = computed(() => {
    const provider = this.formValues().provider as LLMProvider | undefined;
    return PROVIDERS.find((p) => p.value === provider)?.models ?? [];
  });

  readonly selectedProvider = computed(() =>
    PROVIDERS.find((p) => p.value === this.formValues().provider),
  );

  readonly isTesting = computed(() => this.connectionStatus() === 'testing');
  readonly statusIcon = computed(() => {
    switch (this.connectionStatus()) {
      case 'ok':    return 'check_circle';
      case 'error': return 'error';
      default:      return null;
    }
  });

  readonly statusClass = computed(() => {
    switch (this.connectionStatus()) {
      case 'ok':    return 'status-ok';
      case 'error': return 'status-error';
      default:      return '';
    }
  });

  readonly temperatureDisplay = computed(() =>
    (this.formValues().temperature ?? 0.7).toFixed(2),
  );

  onProviderChange(): void {
    const models = this.availableModels();
    this.form.patchValue({ model: models[0] ?? '' });
    this.connectionStatus.set('idle');
  }

  testConnection(): void {
    if (this.form.invalid) return;
    this.connectionStatus.set('testing');
    // Simulate connection test — replace with real HTTP call when wired up.
    setTimeout(() => {
      const ok = Math.random() > 0.3;
      this.connectionStatus.set(ok ? 'ok' : 'error');
    }, 1500);
  }

  saveSettings(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    // Persist to localStorage as a typed settings object (backend integration pending).
    localStorage.setItem('aep_llm_settings', JSON.stringify(value));
  }

  formatTemperature(value: number): string {
    return value.toFixed(2);
  }
}
