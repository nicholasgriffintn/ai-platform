import { SANDBOX_EXECUTION_PROVIDER_DEFINITIONS } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { executeSandboxWorker } from "~/services/sandbox/worker";
import type { IEnv, IUser } from "~/types";

import type { SandboxProvider, SandboxProviderExecuteOptions } from "../index";

export class PolychatSandboxProvider implements SandboxProvider {
  readonly name = "polychat" as const;
  readonly capabilities = SANDBOX_EXECUTION_PROVIDER_DEFINITIONS.polychat.capabilities;

  constructor(
    private readonly env: IEnv,
    private readonly context: ServiceContext,
    private readonly user: IUser,
  ) {}

  execute(options: SandboxProviderExecuteOptions): Promise<Response> {
    return executeSandboxWorker({
      ...options,
      env: this.env,
      context: this.context,
      user: this.user,
    });
  }
}
