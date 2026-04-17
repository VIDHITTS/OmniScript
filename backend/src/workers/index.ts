import { logger } from "../utils/logger";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function startWorkers() {
  logger.info("Starting Background workers...");

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    logger.info({ signal }, "Received shutdown signal, closing workers");

    // Redis shutdown removed - no longer using Redis
    await prisma.$disconnect();

    logger.info("Workers closed. Exiting process.");
    process.exit(0);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

startWorkers().catch((err) => {
  logger.error(err, "Failed to start workers");
  process.exit(1);
});
