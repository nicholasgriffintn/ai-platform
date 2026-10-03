import { assertUnreachable } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { OpenAIAgentsClient } from "~/infrastructure/providers/agents/OpenAIAgentsClient";
import type { IEnv } from "~/types";

import { OpenAIAgentsBrowserProvider } from "./OpenAIAgentsBrowserProvider";
import type { ComputerUseProvider } from "./types";
import { WorkerComputerProvider } from "./WorkerComputerProvider";

export * from "./types";

type ComputerUseConfiguration =
  | { provider: "hosted"; env: IEnv }
  | { provider: "openai"; apiKey: string };

export function getComputerUseProvider(
  configuration: Extract<ComputerUseConfiguration, { provider: "hosted" }>,
): Extract<ComputerUseProvider, { id: "hosted" }>;
export function getComputerUseProvider(
  configuration: Extract<ComputerUseConfiguration, { provider: "openai" }>,
): Extract<ComputerUseProvider, { id: "openai" }>;
export function getComputerUseProvider(
  configuration: ComputerUseConfiguration,
): ComputerUseProvider {
  const { provider } = configuration;

  switch (provider) {
    case "openai":
      return {
        id: "openai",
        mode: "managed",
        sessions: new OpenAIAgentsBrowserProvider(new OpenAIAgentsClient(configuration.apiKey)),
      };
    case "hosted":
      if (!configuration.env.COMPUTER_WORKER) {
        throw new AssistantError(
          "Hosted computers are not configured",
          ErrorType.CONFIGURATION_ERROR,
          503,
        );
      }

      return {
        id: "hosted",
        mode: "interactive",
        control: new WorkerComputerProvider(configuration.env.COMPUTER_WORKER),
      };
  }

  return assertUnreachable(provider);
}
