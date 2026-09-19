import type { ProviderEnv, ProviderUser } from "../../env.js";

export type RerankProviderName = "greenpt";

export type RerankDocument = string | { text: string; id?: string };

export interface RerankRequest {
  env: ProviderEnv;
  user?: ProviderUser;
  query: string;
  documents: RerankDocument[];
  model?: string;
  topN?: number;
  returnDocuments?: boolean;
}

export interface RerankResultItem {
  index: number;
  relevanceScore: number;
  document?: RerankDocument;
}

export interface RerankResult {
  provider: RerankProviderName;
  model: string;
  results: RerankResultItem[];
  usage?: { totalTokens?: number };
}

export interface RerankProvider {
  name: string;
  models: string[];
  rerank(request: RerankRequest): Promise<RerankResult>;
}

export { BaseRerankProvider } from "./base.js";
export * from "./providers/index.js";
