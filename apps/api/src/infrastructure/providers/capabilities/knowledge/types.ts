export interface KnowledgeBaseHit {
  id: string;
  title: string;
  content: string;
  url: string | null;
  score: number;
}

export interface KnowledgeBaseProvider {
  readonly id: string;
  search(query: string, limit: number): Promise<KnowledgeBaseHit[]>;
}
