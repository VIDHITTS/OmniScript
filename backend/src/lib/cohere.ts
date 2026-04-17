import { CohereClient } from 'cohere-ai';
import { env } from '../config/env';

export const cohere = new CohereClient({
  token: env.COHERE_API_KEY,
});
