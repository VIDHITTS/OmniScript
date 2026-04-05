import Redis from "ioredis";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required for BullMQ
});

redis.on("error", (err) => {
  logger.error(err, "Redis Client Error");
});

redis.on("connect", () => {
  logger.info("Connected to Redis");
});
