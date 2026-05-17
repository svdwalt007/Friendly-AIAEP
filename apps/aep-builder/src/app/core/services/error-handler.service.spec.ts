/**
 * @file GlobalErrorHandler unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GlobalErrorHandler } from './error-handler.service';

describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;
  let openSpy: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    openSpy = vi.fn();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    TestBed.configureTestingModule({
      providers: [
        GlobalErrorHandler,
        { provide: MatSnackBar, useValue: { open: openSpy } },
      ],
    });
    handler = TestBed.inject(GlobalErrorHandler);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('shows the error message via MatSnackBar with the dismiss action', () => {
    handler.handleError(new Error('boom'));
    expect(openSpy).toHaveBeenCalledOnce();
    const [message, action, config] = openSpy.mock.calls[0];
    expect(message).toBe('boom');
    expect(action).toBe('Dismiss');
    expect(config).toMatchObject({
      duration: 5000,
      panelClass: ['error-snackbar'],
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
    });
  });

  it('rewrites HTTP failure errors to a network-error message', () => {
    handler.handleError(new Error('Http failure response for /api: 500 Internal'));
    expect(openSpy).toHaveBeenCalledWith(
      'Network error. Please check your connection.',
      'Dismiss',
      expect.any(Object),
    );
  });

  it('falls back to a generic message when the error is not an Error instance', () => {
    handler.handleError({ weird: 'object' });
    expect(openSpy).toHaveBeenCalledWith(
      'An unexpected error occurred',
      'Dismiss',
      expect.any(Object),
    );
  });

  it('logs every error to the console regardless of message extraction', () => {
    handler.handleError('a string');
    handler.handleError(new Error('e'));
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
  });
});
