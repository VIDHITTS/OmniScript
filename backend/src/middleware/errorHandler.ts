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
 * - RateLimitError → returns 429 with retry information
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

  // Handle Groq API errors (400, 413, 429)
  if ((err as any).status === 400 || (err as any).status === 413 || (err as any).status === 429 || err.name === 'RateLimitError') {
    const status = (err as any).status || 429;
    let message = err.message || 'API error occurred.';
    let userMessage = 'An error occurred while processing your request.';
    let details = 'Please try again.';
    
    // Check if it's a daily limit error
    const isDailyLimit = message.includes('per day') || message.includes('TPD') || message.match(/try again in \d+[mh]/);
    
    // Handle bad request (400) - usually tool use errors
    if (status === 400) {
      userMessage = 'Unable to process your request. Please try rephrasing your question.';
      details = 'The AI had trouble understanding your request. Try asking in a different way or be more specific.';
    }
    // Handle request too large (413)
    else if (status === 413) {
      userMessage = 'Request too large. Please try a shorter message or reduce the context.';
      details = 'Your request contains too many tokens. Try asking a shorter question or starting a new chat session.';
    }
    // Handle daily rate limit (429 with long wait time)
    else if (status === 429 && isDailyLimit) {
      userMessage = 'Daily API limit reached. Service will be available tomorrow.';
      details = 'The AI service has reached its daily token limit. Please try again later or contact support.';
    }
    // Handle per-minute rate limit (429)
    else if (status === 429) {
      userMessage = 'Rate limit exceeded. Please try again in a moment.';
      details = 'The AI service is currently rate limited. Please wait a few seconds and try again.';
    }
    
    // Extract retry-after time if available
    let retryAfter = 3; // default 3 seconds
    const match = message.match(/try again in ([\d.]+)s/);
    if (match) {
      retryAfter = Math.ceil(parseFloat(match[1]));
    }

    logger.warn({ err, status, retryAfter, isDailyLimit }, 'Groq API error');

    res.status(status).json({
      error: userMessage,
      statusCode: status,
      retryAfter: isDailyLimit ? null : retryAfter,
      details,
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
