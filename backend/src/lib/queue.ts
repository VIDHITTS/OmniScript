import { Queue } from "bullmq";
import { redis } from "./redis";

export const documentProcessingQueue = new Queue("document-processing", {
  connection: redis,
});
