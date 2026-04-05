import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

// Load environment variables before initializing Prisma
dotenv.config();

class Database {
  private static instance: PrismaClient;

  // Private constructor to prevent direct instantiation
  private constructor() {}

  // Singleton method to get the Prisma instance
  public static getInstance(): PrismaClient {
    if (!Database.instance) {
      const pool = new Pool({
        connectionString:
          process.env.DATABASE_URL ||
          "postgresql://vidhitt.s@localhost:5432/omniscript",
      });
      const adapter = new PrismaPg(pool);
      Database.instance = new PrismaClient({ adapter });
    }
    return Database.instance;
  }
}

export const prisma = Database.getInstance();
