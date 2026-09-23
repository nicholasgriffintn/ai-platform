import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { decisionResponseSchema, type DecisionResponse } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { resolveHostProviderApiKey } from "../../../credentials.js";
import type { ProviderEnv, ProviderUser } from "../../../env.js";
import { fetchProviderJson } from "../../../fetch.js";
import { trackProviderMetrics } from "../../../metrics.js";
import type { ProviderRuntime } from "../../../runtime.js";
import type { DecisionProvider, DecisionRequest } from "../../../types/decision.js";

const logger = getLogger({ prefix: "lib/decision/typesafe" });

export const TYPESAFE_PROVIDER_NAME = "typesafe";
export const TYPESAFE_DEFAULT_MODEL = "jev-latest";
export const TYPESAFE_API_BASE_URL = "https://api.typesafe.ai";

interface TypeSafeSystemOneResponse {
  model?: unknown;
  answers?: unknown;
  usage?: { input_tokens?: unknown; output_tokens?: unknown };
}

function readTokenCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
}

export class TypeSafeDecisionProvider implements DecisionProvider {
  readonly name = TYPESAFE_PROVIDER_NAME;

  constructor(
    private readonly env: ProviderEnv,
    private readonly user: ProviderUser | undefined,
    private readonly runtime: ProviderRuntime,
  ) {}

  async decide(request: DecisionRequest): Promise<DecisionResponse> {
    const model = request.model ?? TYPESAFE_DEFAULT_MODEL;
    const apiKey = await resolveHostProviderApiKey(this.runtime.host, {
      env: this.env,
      providerName: this.name,
      envKeyName: "TYPESAFE_API_KEY",
      userId: this.user?.id,
      logger,
    });
    const baseUrl =
      typeof this.env.TYPESAFE_BASE_URL === "string" && this.env.TYPESAFE_BASE_URL.trim()
        ? this.env.TYPESAFE_BASE_URL.trim().replace(/\/+$/, "")
        : TYPESAFE_API_BASE_URL;

    return trackProviderMetrics(this.runtime.host, {
      provider: this.name,
      model,
      env: this.env,
      userId: this.user?.id,
      completion_id: request.completion_id,
      settings: { questionCount: Object.keys(request.questions).length },
      operation: async () => {
        const raw = await fetchProviderJson<TypeSafeSystemOneResponse>(
          this.name,
          `${baseUrl}/v1/systemone`,
          {
            apiKey,
            body: { state: request.state, model, questions: request.questions },
          },
        );

        return this.normalise(raw, model);
      },
    });
  }

  private normalise(raw: TypeSafeSystemOneResponse, requestedModel: string): DecisionResponse {
    const parsed = decisionResponseSchema.safeParse({
      provider: this.name,
      model: typeof raw.model === "string" && raw.model ? raw.model : requestedModel,
      answers: raw.answers,
      usage: {
        input_tokens: readTokenCount(raw.usage?.input_tokens),
        output_tokens: readTokenCount(raw.usage?.output_tokens),
      },
    });

    if (!parsed.success) {
      logger.error("TypeSafe returned an unexpected decision payload", {
        issues: parsed.error.issues,
      });

      throw new AssistantError(
        "TypeSafe returned an unexpected decision payload",
        ErrorType.PROVIDER_ERROR,
        502,
      );
    }

    return parsed.data;
  }
}
