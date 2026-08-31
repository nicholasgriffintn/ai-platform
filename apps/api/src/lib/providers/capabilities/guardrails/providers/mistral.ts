import type { Ai } from "@cloudflare/workers-types";

import { createServiceContext } from "~/lib/context/serviceContext";
import { getModelConfig } from "~/lib/providers/models";
import type {
  GuardrailInput,
  GuardrailResult,
  GuardrailsProvider,
  GuardrailSource,
  IEnv,
  IUser,
} from "~/types";
import { getLogger } from "~/utils/logger";

import { AssistantError, ErrorType } from "../../../../../utils/errors";
import { getChatProvider } from "../../chat";
import { normaliseGuardrailInput } from "../content";

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

  async validateContent(input: GuardrailInput, _source: GuardrailSource): Promise<GuardrailResult> {
    try {
      logger.debug("Validating content with Mistral Guard");
      const content = normaliseGuardrailInput(input).text;

      const model = "mistral-moderation-latest";
      const modelConfig = await getModelConfig(model);
      const provider = getChatProvider(modelConfig.provider, {
        env: this.config.env,
        user: this.config.user,
      });

      const response = await provider.getResponse(
        {
          model,
          env: this.config.env,
          context: createServiceContext({ env: this.config.env, user: this.config.user }),
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

      logger.debug("Mistral Guard validation result", {
        violations,
        data: response.response,
      });

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

      logger.error("Mistral Guard API error", { error });
      throw AssistantError.fromError(
        error instanceof Error ? error : new Error("Mistral Guard validation failed"),
        ErrorType.PROVIDER_ERROR,
      );
    }
  }
}
