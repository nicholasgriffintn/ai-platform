import type { Ai } from "@cloudflare/workers-types";

import type { GuardrailResult, GuardrailsProvider, IEnv, IUser } from "~/types";
import { getLogger } from "~/utils/logger";
import { AssistantError } from "../../utils/errors";
import { AIProviderFactory } from "../providers/factory";
import { getModelConfig } from "~/lib/models";

const logger = getLogger({ prefix: "lib/guardrails/mistral" });

export interface MistralGuardConfig {
  ai: Ai;
  env: IEnv;
  user?: IUser;
}

export class MistralGuardProvider implements GuardrailsProvider {
  private config: MistralGuardConfig;

  constructor(config: MistralGuardConfig) {
    this.config = config;
  }

  async validateContent(
    content: string,
    source: "INPUT" | "OUTPUT",
  ): Promise<GuardrailResult> {
    try {
      const role = source === "INPUT" ? "user" : "assistant";

      const model = "mistral-moderation-latest";
      const modelConfig = await getModelConfig(model);
      const provider = AIProviderFactory.getProvider(modelConfig.provider);

      const response = await provider.getResponse(
        {
          model,
          env: this.config.env,
          user: this.config.user,
          body: {
            input: content,
          },
        },
        this.config.user?.id,
      );

      const results = response.results;
      const combinedResults = results.reduce((acc: any, result: any) => {
        for (const [category, flagged] of Object.entries(result.categories)) {
          if (flagged) {
            acc[category] = true;
          }
        }
        return acc;
      }, {});
      const violations = Object.keys(combinedResults);
      const isValid = violations.length === 0;

      return {
        provider: "mistral",
        isValid,
        violations,
        rawResponse: response.response,
      };
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }
      logger.error("LLamaGuard API error:", { error });
    }
  }
}
