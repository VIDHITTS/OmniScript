import { groq } from '../lib/groq';

/**
 * Corrective RAG (CRAG) Grader
 * Evaluates whether retrieved chunks actually contain relevant information to answer the query.
 * If irrelevant, we can skip them or trigger a web search/HyDE fallback.
 */
export class CRAGGrader {
  public async evaluateRetrieval(
    query: string,
    chunks: { id: string; content: string }[]
  ): Promise<'RELEVANT' | 'AMBIGUOUS' | 'IRRELEVANT'> {
    if (chunks.length === 0) return 'IRRELEVANT';

    const docText = chunks.map((c, i) => `[Chunk ${i+1}]\n${c.content}`).join('\n---\n');

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant", // Fast and cheap model for grading
      messages: [
        {
          role: "system",
          content: `You are a retrieval evaluator. Rate the relevance of the following document chunks to the user's query.
Return exactly one word: RELEVANT (if the answer is clearly within the chunks), AMBIGUOUS (if it might be there or is partially there), or IRRELEVANT (if it is missing completely). Do not output any other text.`
        },
        {
          role: "user",
          content: `Query: ${query}\n\nChunks:\n${docText}`
        }
      ],
      temperature: 0,
      max_tokens: 10,
    });

    const answer = (response.choices[0]?.message?.content || '').trim().toUpperCase();

    if (answer.includes('RELEVANT') && !answer.includes('IRRELEVANT')) return 'RELEVANT';
    if (answer.includes('IRRELEVANT')) return 'IRRELEVANT';
    if (answer.includes('AMBIGUOUS')) return 'AMBIGUOUS';

    return 'AMBIGUOUS'; // Fallback
  }
}
