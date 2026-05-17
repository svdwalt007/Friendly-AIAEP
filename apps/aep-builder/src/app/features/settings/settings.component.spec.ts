import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        provideRouter([]),
      ],
    });
  });

  it('creates and injects the theme + auth services', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    const instance = fixture.componentInstance;
    expect(instance).toBeTruthy();
    expect(instance.themeService).toBeTruthy();
    expect(instance.authService).toBeTruthy();
  });
});
