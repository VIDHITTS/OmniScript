import { env } from "../config/env";
import { logger } from "../utils/logger";

/**
 * Redis Client (Conditional)
 * 
 * Redis is only initialized if REDIS_URL environment variable is provided.
 * When Redis is unavailable (e.g., Hugging Face Spaces deployment), this exports null.
 * 
 * Services that depend on Redis (queue system, etc.) should check for null and
 * fall back to alternative implementations.
 * 
 * To enable Redis, set REDIS_URL environment variable and install ioredis package.
 */

// Type definition for Redis (when ioredis is available)
type Redis = any;

let redis: Redis | null = null;

if (env.REDIS_URL) {
  try {
    // Dynamically require ioredis only if Redis is configured
    const IORedis = require("ioredis");
    redis = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required for BullMQ
    });

    redis.on("error", (err: any) => {
      logger.error(err, "Redis Client Error");
    });

    redis.on("connect", () => {
      logger.info("Connected to Redis");
    });
  } catch (error) {
    logger.warn("ioredis package not installed, Redis client disabled");
    redis = null;
  }
} else {
  logger.info("REDIS_URL not configured, Redis client disabled");
}

export { redis };
