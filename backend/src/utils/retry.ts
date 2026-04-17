import { logger } from './logger';

/**
 * Retry a function with exponential backoff.
 * Useful for handling rate limits and transient errors.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    shouldRetry?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    shouldRetry = (error: any) => {
      // Don't retry on 413 (request too large) or daily limit errors
      if (error.status === 413) return false;
      
      // Check if it's a daily limit error (mentions "per day" or very long retry time)
      if (error.message && (
        error.message.includes('per day') || 
        error.message.includes('TPD') ||
        error.message.match(/try again in \d+[mh]/)  // Minutes or hours
      )) {
        return false;
      }
      
      // Retry on 429 (rate limit per minute)
      return error.status === 429 || error.name === 'RateLimitError';
    },
  } = options;

  let lastError: any;
  let delayMs = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if we should retry this error
      if (!shouldRetry(error)) {
        throw error;
      }

      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        logger.error(
          { error, attempt, maxRetries },
          'Max retries reached, giving up'
        );
        throw error;
      }

      // Extract retry-after from error message if available
      let waitTime = delayMs;
      if (error.message) {
        const match = error.message.match(/try again in ([\d.]+)s/);
        if (match) {
          waitTime = Math.ceil(parseFloat(match[1]) * 1000);
        }
      }

      logger.warn(
        { error: error.message, attempt: attempt + 1, maxRetries, waitTime },
        'Retrying after rate limit'
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      // Increase delay for next attempt (exponential backoff)
      delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError;
}
