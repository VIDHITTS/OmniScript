import express, { Application, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

import authRoutes from "./modules/auth/auth.routes";
import workspaceRoutes from "./modules/workspace/workspace.routes";

import { env } from "./config/env";
import { logger } from "./utils/logger";
import { gridFsStorage } from "./lib/storage/GridFsStorageService";

// Initialize env variables
dotenv.config();

class App {
  public app: Application;
  public port: number | string;

  constructor() {
    this.app = express();
    this.port = env.PORT;

    this.initializeMiddlewares();
    this.initializeRoutes();
  }

  private initializeMiddlewares() {
    // Basic standard middlewares
    this.app.use(express.json());
    this.app.use(cookieParser());

    // CORS configuration for cookies/session exchange
    this.app.use(
      cors({
        origin: "http://localhost:3000", // adjust this as needed for your frontend
        credentials: true, // Need this to pass cookies front-to-back
      }),
    );
  }

  private initializeRoutes() {
    // Health check
    this.app.get("/health", (req: Request, res: Response) => {
      res
        .status(200)
        .json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // Feature routing
    this.app.use("/api/auth", authRoutes);
    this.app.use("/api/workspaces", workspaceRoutes);
  }

  public async listen() {
    try {
      // Connect to GridFS for storing binary files (PDFs, Audio, etc)
      await gridFsStorage.connect();

      this.app.listen(this.port, () => {
        logger.info(`🚀 Server is running on http://localhost:${this.port}`);
      });
    } catch (error) {
      logger.error(error, "❌ Error starting server");
      process.exit(1);
    }
  }
}

// Instantiate and start
const server = new App();
server.listen();
