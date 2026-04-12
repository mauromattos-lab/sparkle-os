// Voyage-3 Embedding Service — ADR-005: 1024 dims, voyage-3 model
// Uses voyageai npm package directly (not Anthropic SDK — see ADR-005)

import { VoyageAIClient } from 'voyageai';

const MODEL = 'voyage-3';
const EXPECTED_DIMS = 1024;

let _client: VoyageAIClient | null = null;

function getClient(): VoyageAIClient {
  if (!_client) {
    const apiKey = process.env['VOYAGE_API_KEY'];
    if (!apiKey) {
      throw new Error('VOYAGE_API_KEY environment variable is not set');
    }
    _client = new VoyageAIClient({ apiKey });
  }
  return _client;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getClient();
  const response = await client.embed({
    input: [text],
    model: MODEL,
  });

  const embedding = response.data?.[0]?.embedding;
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error('Voyage API returned no embedding data');
  }
  if (embedding.length !== EXPECTED_DIMS) {
    throw new Error(
      `Unexpected embedding dimensions: got ${embedding.length}, expected ${EXPECTED_DIMS}`
    );
  }
  return embedding;
}

export async function checkEmbeddingServiceHealth(): Promise<boolean> {
  try {
    const apiKey = process.env['VOYAGE_API_KEY'];
    if (!apiKey) return false;
    await generateEmbedding('health check');
    return true;
  } catch {
    return false;
  }
}
