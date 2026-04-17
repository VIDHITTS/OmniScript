import { Queue } from "bullmq";

/**
 * Document Processing Queue
 * 
 * This queue is disabled when Redis is unavailable (e.g., Hugging Face Spaces deployment).
 * Document processing falls back to synchronous in-memory processing via documentProcessor.ts.
 * 
 * To enable Redis-based queue processing, set REDIS_URL environment variable.
 */

// Conditionally initialize queue only if Redis is available
let documentProcessingQueue: Queue | null = null;

if (process.env.REDIS_URL) {
  try {
    const { redis } = require("./redis");
    const conn = redis;
    const queueOptions = {
      connection: conn,
    };
    documentProcessingQueue = new Queue("document-processing", queueOptions);
  } catch (error) {
    console.warn("Redis connection failed, queue disabled. Document processing will run synchronously.");
    documentProcessingQueue = null;
  }
} else {
  console.info("REDIS_URL not configured, queue disabled. Document processing will run synchronously.");
}

export { documentProcessingQueue };
