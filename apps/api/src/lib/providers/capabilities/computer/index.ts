import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

import type { ComputerProvider } from "./types";
import { WorkerComputerProvider } from "./WorkerComputerProvider";

export * from "./types";

export function getComputerProvider(env: IEnv): ComputerProvider {
  if (!env.COMPUTER_WORKER) {
    throw new AssistantError(
      "Hosted computers are not configured",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  return new WorkerComputerProvider(env.COMPUTER_WORKER);
}
