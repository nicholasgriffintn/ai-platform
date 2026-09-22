import type { RerankingRequest, RerankingResponse } from "@ngriffin_uk/polychat-schemas";

export interface RerankingProvider {
  readonly name: string;
  rerank(request: RerankingRequest): Promise<RerankingResponse>;
}

export type { RerankingRequest, RerankingResponse };
