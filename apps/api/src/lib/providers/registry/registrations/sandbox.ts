import {
  OpenAIAgentsSandboxProvider,
  PolychatSandboxProvider,
  type SandboxProvider,
} from "../../capabilities/sandbox";
import type { ProviderRegistry } from "../ProviderRegistry";
import type { ProviderRegistration } from "../types";
import { ensureEnv, ensureUser } from "./utils";

const sandboxProviders: ProviderRegistration<SandboxProvider>[] = [
  {
    name: "polychat",
    lifecycle: "transient",
    create: (context) => {
      const env = ensureEnv(context);
      const user = ensureUser(context);

      if (!context.serviceContext || !user) {
        throw new Error("Polychat sandbox provider requires a service context and user");
      }

      return new PolychatSandboxProvider(env, context.serviceContext, user);
    },
    metadata: { vendor: "Polychat", categories: ["sandbox"] },
  },
  {
    name: "openai",
    aliases: ["openai-agents"],
    lifecycle: "transient",
    create: (context) => {
      const env = ensureEnv(context);
      const user = ensureUser(context);

      if (!user) {
        throw new Error("OpenAI sandbox provider requires a user");
      }

      return new OpenAIAgentsSandboxProvider(env, user);
    },
    metadata: {
      vendor: "OpenAI",
      description: "OpenAI-hosted Agents API sandbox",
      categories: ["sandbox"],
    },
  },
];

export function registerSandboxProviders(registry: ProviderRegistry): void {
  for (const registration of sandboxProviders) {
    registry.register("sandbox", registration);
  }
}
