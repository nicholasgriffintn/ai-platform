import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { TeammateComputerRecord } from "~/modules/teammates/infrastructure/TeammateComputerRepository";
import type { IEnv } from "~/types";

import { LocalComputerProvider } from "./LocalComputerProvider";
import type { ComputerProvider } from "./types";
import { WorkerComputerProvider } from "./WorkerComputerProvider";

export * from "./types";

export function getComputerProvider(
  context: ServiceContext,
  computer: TeammateComputerRecord,
): ComputerProvider {
  if (computer.provider.startsWith("local:")) {
    return new LocalComputerProvider(context, computer.provider.slice(6));
  }

  if (computer.provider !== "hosted") {
    throw new AssistantError("Unknown computer provider", ErrorType.CONFIGURATION_ERROR, 503);
  }

  const env: IEnv = context.env;

  if (!env.COMPUTER_WORKER) {
    throw new AssistantError(
      "Hosted computers are not configured",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  return new WorkerComputerProvider(env.COMPUTER_WORKER);
}
