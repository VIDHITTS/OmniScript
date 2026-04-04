import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';

/**
 * Global error-handling middleware (Chain of Responsibility pattern).
 *
 * Catches all errors thrown in controllers/services:
 * - AppError → returns structured { error, statusCode }
 * - ZodError → returns 400 with validation details
 * - Unknown → logs full error, returns generic 500
 *
 * Must be registered LAST in the middleware chain.
 */
export const globalErrorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const formattedErrors = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    res.status(400).json({
      error: 'Validation failed',
      statusCode: 400,
      details: formattedErrors,
    });
    return;
  }

  // Handle known operational errors
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error({ err, statusCode: err.statusCode }, 'Non-operational error');
    }

    res.status(err.statusCode).json({
      error: err.message,
      statusCode: err.statusCode,
    });
    return;
  }

  // Handle unknown / programming errors — never leak internals
  logger.error({ err }, 'Unhandled error');

  res.status(500).json({
    error: 'Internal server error',
    statusCode: 500,
  });
};
