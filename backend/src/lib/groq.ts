import Groq from 'groq-sdk';
import { env } from '../config/env';

/**
 * Groq LLM client (singleton).
 *
 * Groq provides ultra-fast inference for open models (Llama, Mixtral, etc.)
 * with an OpenAI-compatible API. Used for:
 * - Chat completions (retrieval-augmented generation)
 * - Contextual enrichment of chunks
 */
class LLMClient {
  private static instance: Groq;

  private constructor() {}

  public static getInstance(): Groq {
    if (!LLMClient.instance) {
      LLMClient.instance = new Groq({
        apiKey: env.GROQ_API_KEY,
      });
    }
    return LLMClient.instance;
  }
}

export const groqClient = LLMClient.getInstance();
