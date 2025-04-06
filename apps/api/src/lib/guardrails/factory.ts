import type { GuardrailsProvider, IUser } from "../../types";
import { AssistantError, ErrorType } from "../../utils/errors";
import {
  type BedrockGuardrailsConfig,
  BedrockGuardrailsProvider,
} from "./bedrock";
import { type LlamaGuardConfig, LlamaGuardProvider } from "./llamaguard";

// biome-ignore lint/complexity/noStaticOnlyClass: I prefer this pattern
export class GuardrailsProviderFactory {
  static getProvider(
    type: string,
    config: BedrockGuardrailsConfig | LlamaGuardConfig,
    user?: IUser,
  ): GuardrailsProvider {
    switch (type) {
      case "bedrock":
        if (!("guardrailId" in config)) {
          throw new AssistantError(
            "Invalid config for Bedrock provider",
            ErrorType.PARAMS_ERROR,
          );
        }
        return new BedrockGuardrailsProvider(config, user);
      case "llamaguard":
        if (!("ai" in config)) {
          throw new AssistantError(
            "Invalid config for LlamaGuard provider",
            ErrorType.PARAMS_ERROR,
          );
        }
        return new LlamaGuardProvider(config as LlamaGuardConfig);
      default:
        throw new AssistantError(
          `Unsupported guardrails provider: ${type}`,
          ErrorType.PARAMS_ERROR,
        );
    }
  }
}
