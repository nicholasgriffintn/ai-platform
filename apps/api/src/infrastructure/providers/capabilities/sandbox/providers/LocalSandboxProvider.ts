import {
  isMachineOnline,
  SANDBOX_EXECUTION_PROVIDER_DEFINITIONS,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { executeSandboxWorker } from "~/modules/sandbox/application/worker";
import type { IEnv, IUser } from "~/types";

import type { SandboxProvider, SandboxProviderExecuteOptions } from "../index";

export class LocalSandboxProvider implements SandboxProvider {
  readonly name = "local" as const;
  readonly capabilities = SANDBOX_EXECUTION_PROVIDER_DEFINITIONS.local.capabilities;

  constructor(
    private readonly env: IEnv,
    private readonly context: ServiceContext,
    private readonly user: IUser,
  ) {}

  async execute(options: SandboxProviderExecuteOptions): Promise<Response> {
    if (!options.machineId) {
      throw new AssistantError("Choose a desktop for this local sandbox", ErrorType.PARAMS_ERROR);
    }

    const machine = (await this.context.repositories.machines.listForUser(this.user.id)).find(
      (candidate) => candidate.machineId === options.machineId,
    );

    if (!machine || !isMachineOnline(machine) || !machine.capabilities.includes("sandbox")) {
      throw new AssistantError(
        "The selected desktop is not ready to run Docker",
        ErrorType.PARAMS_ERROR,
      );
    }

    return executeSandboxWorker({
      ...options,
      env: this.env,
      context: this.context,
      user: this.user,
    });
  }
}
