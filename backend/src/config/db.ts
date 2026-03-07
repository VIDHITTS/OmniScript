import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
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
      const adapter = new PrismaMariaDb({
        host: "localhost",
        user: "root",
        password: "Vidhit@123",
        database: "omniscript",
        port: 3306,
      });
      Database.instance = new PrismaClient({ adapter });
    }
    return Database.instance;
  }
}

export const prisma = Database.getInstance();
