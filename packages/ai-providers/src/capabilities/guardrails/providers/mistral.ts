import type { Ai } from "@cloudflare/workers-types";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { identifierToWords } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ProviderEnv, ProviderUser } from "../../../env.js";
import type { ProviderRuntime } from "../../../runtime.js";
import type {
  GuardrailInput,
  GuardrailResult,
  GuardrailsProvider,
  GuardrailSource,
} from "../../../types/index.js";
import { normaliseGuardrailInput } from "../content.js";

const logger = getLogger({ prefix: "lib/guardrails/mistral" });

const MISTRAL_CATEGORY_REASONS: Readonly<Record<string, string>> = {
  selfharm: "self-harm",
  pii: "personal information",
  hate_and_discrimination: "hate or discrimination",
  violence_and_threats: "violence or threats",
  dangerous_and_criminal_content: "dangerous or criminal content",
  jailbreaking: "trying to get round the assistant's instructions",
};

export interface MistralGuardConfig {
  ai: Ai;
  env: ProviderEnv;
  user?: ProviderUser;
  model: string;
}

export class MistralGuardProvider implements GuardrailsProvider {
  private config: MistralGuardConfig;

  constructor(
    config: MistralGuardConfig,
    private readonly runtime: ProviderRuntime,
  ) {
    this.config = config;
  }

  async validateContent(input: GuardrailInput, _source: GuardrailSource): Promise<GuardrailResult> {
    try {
      logger.debug("Validating content with Mistral Guard");
      const content = normaliseGuardrailInput(input).text;

      const model = this.config.model;
      const modelConfig = await this.runtime.host.models.getModelConfig(model);

      if (!modelConfig) {
        throw new AssistantError(
          `Model configuration not found for ${model}`,
          ErrorType.CONFIGURATION_ERROR,
        );
      }

      const provider = this.runtime.providers.resolve("chat", modelConfig.provider, {
        env: this.config.env,
        user: this.config.user,
      });

      const response = await provider.getResponse(
        {
          model,
          env: this.config.env,
          context: { env: this.config.env, user: this.config.user },
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
      const reasons = violations.map(
        (category) => MISTRAL_CATEGORY_REASONS[category] ?? identifierToWords(category),
      );
      const isValid = violations.length === 0;

      logger.debug("Mistral Guard validation result", {
        violations,
        data: response.response,
      });

      return {
        provider: "mistral",
        isValid,
        violations,
        reasons,
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
