import { Readable } from "stream";
import { MongoClient, GridFSBucket, ObjectId } from "mongodb";
import { StorageService, FileMetadata } from "./StorageService";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";

export class GridFsStorageService implements StorageService {
  private client: MongoClient;
  private bucket!: GridFSBucket;

  constructor() {
    this.client = new MongoClient(env.MONGO_URI);
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      const db = this.client.db();
      // Bucket name defaults to 'fs' if not specified
      this.bucket = new GridFSBucket(db, { bucketName: "documents" });
      logger.info("MongoDB GridFS successfully connected");
    } catch (error) {
      logger.error({ err: error }, "Failed to connect to MongoDB GridFS");
      throw error;
    }
  }

  upload(stream: Readable, metadata: FileMetadata): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.bucket)
        return reject(
          new Error("GridFS Bucket not initialized. Call connect() first."),
        );

      const uploadStream = this.bucket.openUploadStream(metadata.filename, {
        metadata: {
          originalSize: metadata.size,
          contentType: metadata.contentType,
        },
      });

      stream
        .pipe(uploadStream)
        .on("error", (err) => {
          logger.error(
            { err, filename: metadata.filename },
            "Error uploading file to GridFS",
          );
          reject(err);
        })
        .on("finish", () => {
          resolve(uploadStream.id.toString());
        });
    });
  }

  async download(fileId: string): Promise<Readable> {
    if (!this.bucket) throw new Error("GridFS Bucket not initialized.");

    try {
      const objectId = new ObjectId(fileId);
      const downloadStream = this.bucket.openDownloadStream(objectId);
      return downloadStream;
    } catch (err) {
      logger.error(
        { fileId, err },
        "Error opening download stream from GridFS",
      );
      throw err;
    }
  }

  async delete(fileId: string): Promise<void> {
    if (!this.bucket) throw new Error("GridFS Bucket not initialized.");

    try {
      const objectId = new ObjectId(fileId);
      await this.bucket.delete(objectId);
    } catch (err) {
      logger.error({ fileId, err }, "Failed to delete file from GridFS");
      throw err;
    }
  }
}

// Export a singleton instance
export const gridFsStorage = new GridFsStorageService();
