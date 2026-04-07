import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import dotenv from "dotenv";

import authRoutes from "./modules/auth/auth.routes";
import workspaceRoutes from "./modules/workspace/workspace.routes";
import documentRoutes from "./modules/document/document.routes";
import chatRoutes from "./modules/chat/chat.routes";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { prisma } from "./config/db";
import { redis } from "./lib/redis";
import { gridFsStorage } from "./lib/storage/GridFsStorageService";
import { globalErrorHandler } from "./middleware/errorHandler";

// Initialize env variables
dotenv.config();

const app: Application = express();

// Security and performance middlewares
app.use(helmet());
app.use(compression());
app.use(cookieParser());
app.use(pinoHttp({ logger }));

// CORS configuration for cookies/session exchange
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true, // Need this to pass cookies front-to-back
  }),
);

// Body parsing middleware
app.use(express.json());

// Feature routing
app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/documents", documentRoutes);

// Health check — verifies DB + Redis + MongoDB connectivity
app.get("/health", async (_req: Request, res: Response) => {
  try {
    // Verify PostgreSQL
    await prisma.$queryRawUnsafe("SELECT 1");
    // Verify Redis
    await redis.ping();

    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        postgres: "connected",
        redis: "connected",
        mongodb: gridFsStorage.isConnected() ? "connected" : "disconnected",
      },
    });
  } catch (error) {
    logger.error({ error }, "Health check failed");
    res.status(503).json({
      status: "degraded",
      timestamp: new Date().toISOString(),
      error: "One or more services are unavailable",
    });
  }
});

// Error handling middleware (must be last)
app.use(globalErrorHandler);

// Graceful shutdown logic
const startServer = async () => {
  // Connect to GridFS for storing binary files (PDFs, Audio, etc)
  await gridFsStorage.connect();

  const server = app.listen(env.PORT, () => {
    logger.info(`Server is running on http://localhost:${env.PORT}`);
  });

  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);

    server.close(async () => {
      logger.info("HTTP server closed.");

      try {
        await prisma.$disconnect();
        logger.info("PostgreSQL disconnected.");
      } catch (e) {
        logger.error({ err: e }, "Error disconnecting PostgreSQL");
      }

      try {
        await redis.quit();
        logger.info("Redis disconnected.");
      } catch (e) {
        logger.error({ err: e }, "Error disconnecting Redis");
      }

      process.exit(0);
    });

    // Force exit after 10 seconds if graceful shutdown stalls
    setTimeout(() => {
      logger.error("Graceful shutdown timed out, forcing exit.");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
};

startServer().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
