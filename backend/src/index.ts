import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import pinoHttp from "pino-http";
import dotenv from "dotenv";

import authRoutes from "./modules/auth/auth.routes";
import workspaceRoutes from "./modules/workspace/workspace.routes";
import documentRoutes from "./modules/document/document.routes";
import guestRoutes from "./modules/guest/guest.routes";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { gridFsStorage } from "./lib/storage/GridFsStorageService";
import { globalErrorHandler } from "./middleware/errorHandler";

// Initialize env variables
dotenv.config();

const app: Application = express();

// Security and performance middlewares
app.use(helmet());
app.use(compression());
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
app.use("/api/guest", guestRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/documents", documentRoutes);

// Root route
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({ 
    message: "OmniScript API Server",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      auth: "/api/auth",
      workspaces: "/api/workspaces",
      documents: "/api/documents"
    }
  });
});

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use(globalErrorHandler);

// Graceful shutdown logic
const startServer = async () => {
  // Connect to GridFS for storing binary files (PDFs, Audio, etc)
  await gridFsStorage.connect();

  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`Server is running on http://0.0.0.0:${env.PORT}`);
  });

  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      logger.info("HTTP server closed.");
      process.exit(0);
    });
  };

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
};

startServer().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
