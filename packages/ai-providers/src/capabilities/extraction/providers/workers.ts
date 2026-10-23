import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { ExtractionResponse } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ProviderEnv, ProviderUser } from "../../../env.js";
import { resolveAiGatewayId } from "../../../gateway.js";
import { trackProviderMetrics } from "../../../metrics.js";
import type { ProviderRuntime } from "../../../runtime.js";
import type { ExtractionProvider, ExtractionRequest } from "../../../types/extraction.js";
import { normaliseExtractionResponse } from "../../../utils/extractions.js";
import {
  resolveWorkersExtractionModel,
  validateWorkersExtractionRequest,
} from "../../../utils/workers-extractions.js";

const logger = getLogger({ prefix: "lib/extraction/workers" });

export const WORKERS_AI_EXTRACTION_PROVIDER_NAME = "workers-ai";

export class WorkersAiExtractionProvider implements ExtractionProvider {
  readonly name = WORKERS_AI_EXTRACTION_PROVIDER_NAME;

  constructor(
    private readonly env: ProviderEnv,
    private readonly user: ProviderUser | undefined,
    private readonly runtime: ProviderRuntime,
  ) {}

  async extract(request: ExtractionRequest): Promise<ExtractionResponse> {
    const { model, selector } = resolveWorkersExtractionModel(request.model);

    validateWorkersExtractionRequest(request);
    const ai = this.env.AI;

    if (!ai) {
      throw new AssistantError(
        "AI binding is required for Workers AI extractions",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    return trackProviderMetrics(this.runtime.host, {
      provider: this.name,
      model,
      env: this.env,
      userId: this.user?.id,
      completion_id: request.completion_id,
      request: {
        env: this.env,
        completion_id: request.completion_id,
        conversationId: request.conversationId,
      },
      settings: { fieldCount: Object.keys(request.fields).length },
      operation: async () => {
        let raw: unknown;

        try {
          raw = await ai.run(
            model,
            {
              model: selector,
              state: request.state ?? "",
              fields: request.fields,
              ...(request.images?.length ? { images: request.images } : {}),
              ...(request.reference_date ? { reference_date: request.reference_date } : {}),
              ...(request.options ? { options: request.options } : {}),
            },
            { gateway: { id: resolveAiGatewayId(), skipCache: true } },
          );
        } catch (error) {
          logger.error("Workers AI extraction failed", {
            errorType: error instanceof AssistantError ? error.type : "unknown",
          });

          if (error instanceof AssistantError) {
            throw new AssistantError("Workers AI extraction failed", error.type, error.statusCode, {
              retryAfterMs: error.context?.retryAfterMs,
            });
          }

          throw new AssistantError("Workers AI extraction failed", ErrorType.EXTERNAL_API_ERROR);
        }

        return { ...normaliseExtractionResponse(raw, this.name, model, request.fields), model };
      },
    });
  }
}
