/**
 * Document Processing Queue
 * 
 * This queue is disabled when Redis is unavailable (e.g., Hugging Face Spaces deployment).
 * Document processing falls back to synchronous in-memory processing via documentProcessor.ts.
 * 
 * To enable Redis-based queue processing, set REDIS_URL environment variable and install
 * bullmq and ioredis packages.
 */

// Type definition for Queue (when bullmq is available)
type Queue = any;

// Conditionally initialize queue only if Redis is available
let documentProcessingQueue: Queue | null = null;

if (process.env.REDIS_URL) {
  try {
    // Dynamically require bullmq only if Redis is configured
    const { Queue } = require("bullmq");
    const { redis } = require("./redis");
    const conn = redis;
    const queueOptions = {
      connection: conn,
    };
    documentProcessingQueue = new Queue("document-processing", queueOptions);
  } catch (error) {
    console.warn("Redis connection failed or bullmq not installed, queue disabled. Document processing will run synchronously.");
    documentProcessingQueue = null;
  }
} else {
  console.info("REDIS_URL not configured, queue disabled. Document processing will run synchronously.");
}

export { documentProcessingQueue };
