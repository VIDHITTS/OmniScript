import { Readable } from 'stream';

export interface FileMetadata {
  filename: string;
  contentType: string;
  size: number;
}

export interface StorageService {
  /**
   * Uploads a file from a readable stream.
   * @returns The generated unique ID of the stored file.
   */
  upload(stream: Readable, metadata: FileMetadata): Promise<string>;

  /**
   * Downloads a file stream by its ID.
   */
  download(fileId: string): Promise<Readable>;

  /**
   * Deletes a file by its ID.
   */
  delete(fileId: string): Promise<void>;

  /**
   * Connects/initializes the storage backend.
   */
  connect(): Promise<void>;
}