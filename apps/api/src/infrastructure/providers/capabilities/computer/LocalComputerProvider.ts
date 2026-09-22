import type { TeammateComputerInput } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { runMachineComputerOperation } from "~/modules/machines/application/computer";

import type { ComputerProvider, ComputerResource } from "./types";

export class LocalComputerProvider implements ComputerProvider {
  constructor(
    private readonly context: ServiceContext,
    private readonly machineId: string,
  ) {}

  private request(
    resourceId: string,
    fence: number,
    operation: Parameters<typeof runMachineComputerOperation>[0]["operation"],
  ) {
    return runMachineComputerOperation({
      context: this.context,
      machineId: this.machineId,
      resourceId,
      fence,
      operation,
    });
  }

  private requireHandle(resourceId: string, handle: string): void {
    if (handle !== resourceId) {
      throw new AssistantError(
        "The local browser handle is invalid",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }
  }

  async provision(input: {
    resourceId: string;
    checkpointReference?: string | null;
  }): Promise<ComputerResource> {
    if (input.checkpointReference) {
      throw new AssistantError("Local browser checkpoints are unavailable", ErrorType.PARAMS_ERROR);
    }

    const result = await this.request(input.resourceId, 0, { type: "start" });

    if (result.handle !== input.resourceId) {
      throw new AssistantError(
        "The desktop returned an invalid browser handle",
        ErrorType.PROVIDER_ERROR,
      );
    }

    return { handle: input.resourceId };
  }

  observe(input: { resourceId: string; handle: string; fence: number }) {
    this.requireHandle(input.resourceId, input.handle);

    return this.request(input.resourceId, input.fence, { type: "observe" });
  }

  input(input: {
    resourceId: string;
    handle: string;
    fence: number;
    input: TeammateComputerInput;
  }) {
    this.requireHandle(input.resourceId, input.handle);

    return this.request(input.resourceId, input.fence, { type: "input", input: input.input });
  }

  async connectScreen(): Promise<never> {
    throw new AssistantError("The local browser is visible on the desktop", ErrorType.PARAMS_ERROR);
  }

  async connectViewScreen(): Promise<never> {
    throw new AssistantError("The local browser is visible on the desktop", ErrorType.PARAMS_ERROR);
  }

  async getTeachingRecording(): Promise<never> {
    throw new AssistantError(
      "Local browser teaching recordings are unavailable",
      ErrorType.PARAMS_ERROR,
    );
  }

  async revokeControl(input: { resourceId: string; handle: string; fence: number }): Promise<void> {
    this.requireHandle(input.resourceId, input.handle);
    await this.request(input.resourceId, input.fence, { type: "revoke" });
  }

  async checkpoint(): Promise<never> {
    throw new AssistantError("Local browser checkpoints are unavailable", ErrorType.PARAMS_ERROR);
  }

  async restore(): Promise<never> {
    throw new AssistantError("Local browser checkpoints are unavailable", ErrorType.PARAMS_ERROR);
  }

  async stop(input: { resourceId: string; handle: string; fence: number }): Promise<void> {
    this.requireHandle(input.resourceId, input.handle);
    await this.request(input.resourceId, input.fence, { type: "stop" });
  }

  async destroy(input: { resourceId: string; handle: string; fence: number }): Promise<void> {
    await this.stop(input);
  }
}
