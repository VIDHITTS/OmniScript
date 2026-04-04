/**
 * AppError — Custom error class for operational errors.
 *
 * Design decision: Separate operational errors (bad user input, not found, etc.)
 * from programming errors (null reference, etc.). The global error handler
 * only sends details for operational errors; programming errors get a generic 500.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Maintains proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);

    // Captures stack trace, excluding constructor call from it
    Error.captureStackTrace(this, this.constructor);
  }

  // Factory methods for common HTTP errors
  static badRequest(message = 'Bad request'): AppError {
    return new AppError(400, message);
  }

  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(401, message);
  }

  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(403, message);
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError(404, message);
  }

  static conflict(message = 'Resource already exists'): AppError {
    return new AppError(409, message);
  }

  static internal(message = 'Internal server error'): AppError {
    return new AppError(500, message, false);
  }
}
