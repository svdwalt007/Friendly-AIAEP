/**
 * Error handling for SDK generation and API interactions
 * Provides structured error types for Friendly API communications
 */

/**
 * Options for constructing a FriendlyApiError
 */
export interface FriendlyApiErrorOptions {
  /**
   * HTTP status code associated with the error
   * @example 404, 500, 401
   */
  statusCode: number;

  /**
   * Human-readable error message
   */
  message: string;

  /**
   * Optional request identifier for tracking/debugging
   */
  requestId?: string;

  /**
   * Which API source the error originated from
   */
  apiSource: 'northbound' | 'events' | 'qoe';

  /**
   * Additional error details (stack traces, validation errors, etc.)
   */
  details?: any;
}

/**
 * Custom error class for Friendly API operations
 *
 * @example
 * ```typescript
 * throw new FriendlyApiError({
 *   statusCode: 404,
 *   message: 'Device not found',
 *   requestId: 'req-123',
 *   apiSource: 'northbound',
 *   details: { deviceId: 'dev-456' }
 * });
 * ```
 */
export class FriendlyApiError extends Error {
  /**
   * HTTP status code associated with the error
   */
  public readonly statusCode: number;

  /**
   * Optional request identifier for tracking/debugging
   */
  public readonly requestId?: string;

  /**
   * Which API source the error originated from
   */
  public readonly apiSource: string;

  /**
   * Additional error details (stack traces, validation errors, etc.)
   */
  public readonly details?: any;

  /**
   * Creates a new FriendlyApiError
   *
   * @param options - Error configuration options
   */
  constructor(options: FriendlyApiErrorOptions) {
    super(options.message);
    this.name = 'FriendlyApiError';
    this.statusCode = options.statusCode;
    this.requestId = options.requestId;
    this.apiSource = options.apiSource;
    this.details = options.details;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FriendlyApiError);
    }
  }

  /**
   * Converts the error to a JSON-serializable object
   * Useful for logging, API responses, and error reporting
   *
   * @returns JSON representation of the error
   */
  toJSON() {
    return {
      name: this.name,
      statusCode: this.statusCode,
      message: this.message,
      requestId: this.requestId,
      apiSource: this.apiSource,
      details: this.details,
    };
  }

  /**
   * Creates a formatted string representation of the error
   *
   * @returns Formatted error message
   */
  override toString(): string {
    const parts = [
      `${this.name} [${this.statusCode}]`,
      this.message,
    ];

    if (this.requestId) {
      parts.push(`(Request ID: ${this.requestId})`);
    }

    parts.push(`- API Source: ${this.apiSource}`);

    return parts.join(' ');
  }

  /**
   * Checks if the error represents a client error (4xx status code)
   *
   * @returns true if status code is in the 400-499 range
   */
  isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500;
  }

  /**
   * Checks if the error represents a server error (5xx status code)
   *
   * @returns true if status code is in the 500-599 range
   */
  isServerError(): boolean {
    return this.statusCode >= 500 && this.statusCode < 600;
  }

  /**
   * Checks if the error is retryable (based on status code)
   * Typically server errors and some specific client errors are retryable
   *
   * @returns true if the operation could potentially succeed on retry
   */
  isRetryable(): boolean {
    // Server errors are typically retryable
    if (this.isServerError()) {
      return true;
    }

    // Some client errors are retryable
    const retryableClientErrors = [
      408, // Request Timeout
      429, // Too Many Requests
    ];

    return retryableClientErrors.includes(this.statusCode);
  }
}

/**
 * Factory function to create a FriendlyApiError from an HTTP response
 *
 * @param response - HTTP response object
 * @param apiSource - Which API the error originated from
 * @returns A new FriendlyApiError instance
 *
 * @example
 * ```typescript
 * const error = createFromResponse(response, 'northbound');
 * if (error.isRetryable()) {
 *   // Implement retry logic
 * }
 * ```
 */
export function createFromResponse(
  response: { status: number; statusText: string; data?: any },
  apiSource: 'northbound' | 'events' | 'qoe'
): FriendlyApiError {
  return new FriendlyApiError({
    statusCode: response.status,
    message: response.statusText || 'Unknown error',
    apiSource,
    details: response.data,
  });
}

/**
 * Type guard to check if an error is a FriendlyApiError
 *
 * @param error - Error to check
 * @returns true if the error is a FriendlyApiError
 *
 * @example
 * ```typescript
 * try {
 *   await apiCall();
 * } catch (error) {
 *   if (isFriendlyApiError(error)) {
 *     console.log(`API error from ${error.apiSource}: ${error.message}`);
 *   }
 * }
 * ```
 */
export function isFriendlyApiError(error: unknown): error is FriendlyApiError {
  return error instanceof FriendlyApiError;
}
