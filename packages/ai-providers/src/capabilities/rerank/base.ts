import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ProviderRuntime } from "../../runtime.js";
import type { RerankProvider, RerankRequest, RerankResult } from "./index.js";

const MAX_RERANK_DOCUMENTS = 1000;

export abstract class BaseRerankProvider implements RerankProvider {
  abstract name: string;
  abstract models: string[];

  constructor(protected readonly runtime: ProviderRuntime) {}

  protected validateRequest(request: RerankRequest): void {
    if (!request.query?.trim()) {
      throw new AssistantError("Missing rerank query", ErrorType.PARAMS_ERROR);
    }

    if (!Array.isArray(request.documents) || request.documents.length === 0) {
      throw new AssistantError("Missing rerank documents", ErrorType.PARAMS_ERROR);
    }

    if (request.documents.length > MAX_RERANK_DOCUMENTS) {
      throw new AssistantError(
        `Rerank supports at most ${MAX_RERANK_DOCUMENTS} documents`,
        ErrorType.PARAMS_ERROR,
      );
    }

    if (request.topN !== undefined && (!Number.isInteger(request.topN) || request.topN < 1)) {
      throw new AssistantError("topN must be a positive integer", ErrorType.PARAMS_ERROR);
    }
  }

  protected resolveModel(request: RerankRequest): string {
    const model = request.model ?? this.models[0];

    if (!model || !this.models.includes(model)) {
      throw new AssistantError(
        `Model ${model} is not supported by the ${this.name} rerank provider`,
        ErrorType.PARAMS_ERROR,
      );
    }

    return model;
  }

  abstract rerank(request: RerankRequest): Promise<RerankResult>;
}
