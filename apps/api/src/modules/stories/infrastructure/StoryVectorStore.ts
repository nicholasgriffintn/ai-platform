export type VectorMetadata = Record<string, string | number>;

export interface VectorStoreMatch {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface StoryVectorStore {
  query(
    vector: readonly number[],
    topK: number,
    window?: { since: number; until: number },
  ): Promise<VectorStoreMatch[]>;
  upsert(id: string, values: readonly number[], metadata: VectorMetadata): Promise<void>;
  get(id: string): Promise<number[] | null>;
  remove(id: string): Promise<void>;
}

export class VectorizeStoryVectorStore implements StoryVectorStore {
  constructor(private readonly index: Vectorize) {}

  async query(
    vector: readonly number[],
    topK: number,
    window?: { since: number; until: number },
  ): Promise<VectorStoreMatch[]> {
    const result = await this.index.query([...vector], {
      topK,
      ...(window
        ? {
            returnMetadata: "all" as const,
            filter: { publishedAt: { $gte: window.since, $lte: window.until } },
          }
        : {}),
    });

    return result.matches.map((match) => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata ?? {},
    }));
  }

  async upsert(id: string, values: readonly number[], metadata: VectorMetadata): Promise<void> {
    await this.index.upsert([{ id, values: [...values], metadata }]);
  }

  async remove(id: string): Promise<void> {
    await this.index.deleteByIds([id]);
  }

  async get(id: string): Promise<number[] | null> {
    const [vector] = await this.index.getByIds([id]);

    return vector ? Array.from(vector.values) : null;
  }
}
