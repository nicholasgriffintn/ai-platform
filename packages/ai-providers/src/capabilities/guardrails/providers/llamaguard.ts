import type { Ai } from "@cloudflare/workers-types";
import { getPromptText } from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
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

const logger = getLogger({ prefix: "lib/guardrails/llamaguard" });

export interface LlamaGuardConfig {
  ai: Ai;
  env: ProviderEnv;
  user?: ProviderUser;
}

export class LlamaGuardProvider implements GuardrailsProvider {
  private config: LlamaGuardConfig;

  constructor(
    config: LlamaGuardConfig,
    private readonly runtime: ProviderRuntime,
  ) {
    this.config = config;
  }

  async validateContent(input: GuardrailInput, source: GuardrailSource): Promise<GuardrailResult> {
    try {
      logger.debug("Validating content with Llama Guard");
      const content = normaliseGuardrailInput(input).text;
      const unsafeCategories = getPromptText("providers/guardrails/llamaguard/categories");

      const role = source === "INPUT" ? "user" : "assistant";

      const { model, provider: providerToUse } =
        await this.runtime.host.models.getAuxiliaryGuardrailsModel(
          this.config.env,
          this.config.user,
        );

      const provider = this.runtime.providers.resolve("chat", providerToUse, {
        env: this.config.env,
        user: this.config.user,
      });

      const response = await provider.getResponse(
        {
          model,
          env: this.config.env,
          context: { env: this.config.env, user: this.config.user },
          messages: [
            {
              role: "user",
              content: `<|begin_of_text|><|start_header_id|>user<|end_header_id|>

<|image|> Task: Check if there is unsafe content in '${role}' messages in conversations according to our safety policy with the below categories.

<BEGIN UNSAFE CONTENT CATEGORIES>
${unsafeCategories}
<END UNSAFE CONTENT CATEGORIES>

<BEGIN CONVERSATION>

${role}: ${content}

<END CONVERSATION>

Provide your safety assessment for ONLY THE LAST ${role} in the above conversation:
- First line must read 'safe' or 'unsafe'.
- If unsafe, a second line must include a comma-separated list of violated categories.<|eot_id|><|start_header_id|>assistant<|end_header_id|>`,
            },
          ],
        },
        this.config.user?.id,
      );

      const responseText = response.response.toLowerCase().trim();
      const [verdict] = responseText.split(/\s|\n/, 1);
      const isValid = verdict === "safe";
      const violations = isValid ? [] : [response.response];

      logger.debug("Llama Guard validation result", {
        violations,
        data: response.response,
      });

      return {
        provider: "llamaguard",
        isValid,
        violations,
        rawResponse: response.response,
      };
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }

      logger.error("LLamaGuard API error:", { error });
      throw AssistantError.fromError(
        error instanceof Error ? error : new Error("LlamaGuard validation failed"),
        ErrorType.PROVIDER_ERROR,
      );
    }
  }
}
