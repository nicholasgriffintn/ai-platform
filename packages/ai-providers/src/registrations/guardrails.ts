import {
  BedrockGuardrailsProvider,
  type BedrockGuardrailsConfig,
} from "../capabilities/guardrails/providers/bedrock.js";
import {
  LlamaGuardProvider,
  type LlamaGuardConfig,
} from "../capabilities/guardrails/providers/llamaguard.js";
import {
  MistralGuardProvider,
  type MistralGuardConfig,
} from "../capabilities/guardrails/providers/mistral.js";
import {
  ShieldstralGuardProvider,
  type ShieldstralGuardConfig,
} from "../capabilities/guardrails/providers/shieldstral.js";
import type { AiProviderRegistration, AiProviderRegistry, ProviderRuntime } from "../runtime.js";
import type { GuardrailsProvider } from "../types/index.js";
import { ensureEnv, ensureConfig } from "./utils.js";

function guardrailsProviders(
  runtime: ProviderRuntime,
): AiProviderRegistration<GuardrailsProvider>[] {
  return [
    {
      name: "bedrock",
      lifecycle: "transient",
      create: (context) => {
        const _env = ensureEnv(context);
        const config = ensureConfig<BedrockGuardrailsConfig>(
          context,
          "Bedrock guardrails config required",
        );

        return new BedrockGuardrailsProvider(config, context.user, runtime);
      },
      metadata: {
        vendor: "AWS",
        categories: ["guardrails"],
        tags: ["bedrock"],
      },
    },
    {
      name: "llamaguard",
      lifecycle: "transient",
      create: (context) => {
        const _env = ensureEnv(context);
        const config = ensureConfig<LlamaGuardConfig>(context, "LlamaGuard config required");

        return new LlamaGuardProvider(config, runtime);
      },
      metadata: {
        vendor: "Meta",
        categories: ["guardrails"],
        tags: ["llama"],
      },
    },
    {
      name: "mistral",
      lifecycle: "transient",
      create: (context) => {
        const _env = ensureEnv(context);
        const config = ensureConfig<MistralGuardConfig>(
          context,
          "Mistral guardrails config required",
        );

        return new MistralGuardProvider(config, runtime);
      },
      metadata: {
        vendor: "Mistral AI",
        categories: ["guardrails"],
      },
    },
    {
      name: "shieldstral",
      lifecycle: "transient",
      create: (context) => {
        ensureEnv(context);
        const config = ensureConfig<ShieldstralGuardConfig>(
          context,
          "Shieldstral guardrails config required",
        );

        return new ShieldstralGuardProvider(config);
      },
      metadata: {
        vendor: "Mistral AI",
        categories: ["guardrails"],
        tags: ["multimodal", "open-weights", "policy-adaptive"],
      },
    },
  ];
}

export function registerGuardrailProviders(
  registry: AiProviderRegistry,
  runtime: ProviderRuntime,
): void {
  for (const registration of guardrailsProviders(runtime)) {
    registry.register("guardrails", registration);
  }
}
