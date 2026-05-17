import { ErrorHandler, Injectable, NgZone, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private snackBar = inject(MatSnackBar);
  private ngZone = inject(NgZone);

  handleError(error: unknown): void {
    const message = this.extractMessage(error);
    console.error('Global error:', error);

    this.ngZone.run(() => {
      this.snackBar.open(message, 'Dismiss', {
        duration: 5000,
        panelClass: ['error-snackbar'],
        horizontalPosition: 'end',
        verticalPosition: 'bottom',
      });
    });
  }

  private extractMessage(error: unknown): string {
    if (error instanceof Error) {
      if (error.message.includes('Http failure')) {
        return 'Network error. Please check your connection.';
      }
      return error.message;
    }
    return 'An unexpected error occurred';
  }
}
