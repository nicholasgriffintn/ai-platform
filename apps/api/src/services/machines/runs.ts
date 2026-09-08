import { isMachineOnline, machineRunRequestSchema } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { getDurableObjectStub, postDurableObjectJson } from "~/lib/durable-objects/client";
import { AssistantError, ErrorType } from "~/utils/errors";

export async function callMachineRun(
  context: ServiceContext,
  machineId: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const user = context.requireUser();
  const settings = await context.getUserSettings();
  const machine = (await context.repositories.machines.listForUser(user.id)).find(
    (item) => item.machineId === machineId,
  );

  if (settings?.advertise_machines === false || !machine) {
    throw new AssistantError("Machine unavailable", ErrorType.NOT_FOUND);
  }

  if (path === "/create") {
    const input = machineRunRequestSchema.parse(body);

    if (
      !isMachineOnline(machine) ||
      !machine.capabilities.includes("model-relay") ||
      !machine.runtimes.some(
        (runtime) =>
          runtime.vendor === input.vendor &&
          runtime.readiness.status === "ready" &&
          runtime.models.some((model) => model.nativeId === input.nativeModelId),
      )
    ) {
      throw new AssistantError(
        "The model is not available on this machine.",
        ErrorType.PARAMS_ERROR,
      );
    }
  }

  const stub = getDurableObjectStub(context.env.MACHINE_RUN_COORDINATOR, `${user.id}:${machineId}`);

  if (!stub) {
    throw new AssistantError(
      "Machine execution is not configured on this server.",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return postDurableObjectJson(stub, `https://machine-runs${path}`, body);
}
