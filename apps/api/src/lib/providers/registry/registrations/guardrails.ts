import type { GuardrailsProvider } from "~/types";

import {
  BedrockGuardrailsProvider,
  type BedrockGuardrailsConfig,
} from "../../capabilities/guardrails/providers/bedrock";
import {
  LlamaGuardProvider,
  type LlamaGuardConfig,
} from "../../capabilities/guardrails/providers/llamaguard";
import {
  MistralGuardProvider,
  type MistralGuardConfig,
} from "../../capabilities/guardrails/providers/mistral";
import {
  ShieldstralGuardProvider,
  type ShieldstralGuardConfig,
} from "../../capabilities/guardrails/providers/shieldstral";
import type { ProviderRegistry } from "../ProviderRegistry";
import type { ProviderRegistration } from "../types";
import { ensureEnv, ensureConfig } from "./utils";

const guardrailsProviders: ProviderRegistration<GuardrailsProvider>[] = [
  {
    name: "bedrock",
    lifecycle: "transient",
    create: (context) => {
      const _env = ensureEnv(context);
      const config = ensureConfig<BedrockGuardrailsConfig>(
        context,
        "Bedrock guardrails config required",
      );

      return new BedrockGuardrailsProvider(config, context.user);
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

      return new LlamaGuardProvider(config);
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

      return new MistralGuardProvider(config);
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

export function registerGuardrailProviders(registry: ProviderRegistry): void {
  for (const registration of guardrailsProviders) {
    registry.register("guardrails", registration);
  }
}
