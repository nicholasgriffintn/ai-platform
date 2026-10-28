import { isMachineOnline, machineRunRequestSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  getDurableObjectStub,
  postDurableObjectJson,
} from "~/infrastructure/durable-objects/client";
import { MachineRepository } from "~/modules/machines/infrastructure/MachineRepository";
import { publishMachineEvent } from "~/modules/sync/application/conversation-events";
import { getRequestUserSettings } from "~/modules/user/application/request-settings";

const OWNER_ONLY_PATHS: ReadonlySet<string> = new Set(["/claim", "/update"]);

export async function callMachineRun(
  context: ServiceContext,
  machineId: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const user = context.requireUser();
  const settings = await getRequestUserSettings(context);
  const machine = await context.repositories
    .get(MachineRepository)
    .findAccessible(user.id, machineId);
  const owned = machine?.userId === user.id;

  if (
    !machine ||
    (owned && settings?.advertise_machines === false) ||
    (!owned && OWNER_ONLY_PATHS.has(path))
  ) {
    throw new AssistantError("Machine unavailable", ErrorType.NOT_FOUND);
  }

  if (path === "/create") {
    const input = machineRunRequestSchema.parse(body);
    const runtimeAvailable = machine.runtimes.some((runtime) => {
      if ("kind" in input && input.kind === "tool") {
        return (
          runtime.kind === "local-tools" &&
          runtime.directories.some((directory) => directory.id === input.directoryId) &&
          machine.capabilities.includes("local-tools")
        );
      }

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

    if (!isMachineOnline(machine)) {
      throw new AssistantError(
        `Waiting for ${owned ? (user.name ?? "you") : "its owner"} to bring ${machine.label} back online. Open Polychat on that machine to carry on.`,
        ErrorType.PARAMS_ERROR,
      );
    }

    if (!runtimeAvailable) {
      throw new AssistantError(
        "kind" in input && input.kind === "tool"
          ? "That folder is not available on this machine right now."
          : "The model is not available on this machine.",
        ErrorType.PARAMS_ERROR,
      );
    }
  }

  const stub = getDurableObjectStub(
    context.env.MACHINE_RUN_COORDINATOR,
    `${machine.userId}:${machineId}`,
  );

  if (!stub) {
    throw new AssistantError(
      "Machine execution is not configured on this server.",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const response = await postDurableObjectJson(stub, `https://machine-runs${path}`, body);

  if (path === "/create" && response.ok) {
    publishMachineEvent(context, machine.userId, machineId, { queued: true });
  }

  return response;
}
