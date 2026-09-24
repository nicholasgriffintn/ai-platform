import {
  machineComputerRunRequestSchema,
  machineRunSnapshotSchema,
} from "@ngriffin_uk/polychat-schemas";
import { abortableDelay } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { STALE_COMPUTER_LEASE_ERROR_CODE } from "~/infrastructure/providers/capabilities/computer/types";

import { callMachineRun } from "./runs";

const POLL_INTERVAL_MS = 1000;
const DEADLINE_MS = 120_000;

export async function runMachineComputerOperation(params: {
  context: ServiceContext;
  machineId: string;
  resourceId: string;
  fence: number;
  operation: z.infer<typeof machineComputerRunRequestSchema>["operation"];
}): Promise<Record<string, unknown>> {
  const id = crypto.randomUUID();
  const request = machineComputerRunRequestSchema.parse({
    id,
    kind: "computer",
    resourceId: params.resourceId,
    fence: params.fence,
    operation: params.operation,
  });
  const started = await callMachineRun(params.context, params.machineId, "/create", request);

  if (!started.ok) {
    throw new AssistantError(
      "The desktop is busy or unavailable",
      ErrorType.PROVIDER_ERROR,
      started.status,
    );
  }

  let snapshot = machineRunSnapshotSchema.parse(await started.json());
  const deadline = Date.now() + DEADLINE_MS;

  while (snapshot.state === "pending" || snapshot.state === "running") {
    if (Date.now() >= deadline) {
      await callMachineRun(params.context, params.machineId, `/cancel/${id}`).catch(
        () => undefined,
      );
      throw new AssistantError("The local browser timed out", ErrorType.PROVIDER_ERROR);
    }

    await abortableDelay(POLL_INTERVAL_MS);
    const response = await callMachineRun(params.context, params.machineId, `/read/${id}`);

    if (!response.ok) {
      throw new AssistantError("The desktop browser stopped responding", ErrorType.PROVIDER_ERROR);
    }

    snapshot = machineRunSnapshotSchema.parse(await response.json());
  }

  if (snapshot.state !== "completed") {
    if (snapshot.error?.includes("browser control lease is stale")) {
      throw new AssistantError(snapshot.error, ErrorType.CONFLICT_ERROR, 409, {
        code: STALE_COMPUTER_LEASE_ERROR_CODE,
      });
    }

    throw new AssistantError(
      snapshot.error || "The local browser failed",
      ErrorType.PROVIDER_ERROR,
    );
  }

  return z.record(z.string(), z.unknown()).parse(safeParseJson(snapshot.text));
}
