import Redis from "ioredis";
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
 */

let redis: Redis | null = null;

if (env.REDIS_URL) {
  redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // Required for BullMQ
  });

  redis.on("error", (err) => {
    logger.error(err, "Redis Client Error");
  });

  redis.on("connect", () => {
    logger.info("Connected to Redis");
  });
} else {
  logger.info("REDIS_URL not configured, Redis client disabled");
}

export { redis };
