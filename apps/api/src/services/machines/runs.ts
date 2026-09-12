import { isMachineOnline, machineRunRequestSchema } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { getDurableObjectStub, postDurableObjectJson } from "~/lib/durable-objects/client";
import { publishMachineEvent } from "~/services/sync/conversation-events";
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
    const runtimeAvailable = machine.runtimes.some((runtime) => {
      if ("kind" in input && input.kind === "agent") {
        return (
          runtime.kind === "agent" &&
          runtime.vendor === input.driver &&
          runtime.readiness.state === "ready" &&
          runtime.supportsSessions &&
          machine.capabilities.includes("agent-run")
        );
      }

      return (
        "vendor" in input &&
        runtime.kind === "model" &&
        runtime.vendor === input.vendor &&
        runtime.readiness.status === "ready" &&
        runtime.models.some((model) => model.nativeId === input.nativeModelId) &&
        machine.capabilities.includes("model-relay")
      );
    });

    if (!isMachineOnline(machine) || !runtimeAvailable) {
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

  const response = await postDurableObjectJson(stub, `https://machine-runs${path}`, body);

  if (path === "/create" && response.ok) {
    publishMachineEvent(context, user.id, machineId, { queued: true });
  }

  return response;
}
