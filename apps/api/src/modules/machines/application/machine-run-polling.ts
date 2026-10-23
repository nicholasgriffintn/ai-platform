import { machineRunSnapshotSchema, type MachineRunSnapshot } from "@ngriffin_uk/polychat-schemas";
import { abortableDelay } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";

import { callMachineRun } from "./runs";

const MACHINE_RUN_POLL_INTERVAL_MS = 1000;

export const MACHINE_RUN_MAX_DURATION_MS = 10 * 60 * 1000;

export async function parseMachineSnapshot(response: Response): Promise<MachineRunSnapshot> {
  if (!response.ok) {
    throw new AssistantError(
      `Machine execution failed (${response.status})`,
      ErrorType.PROVIDER_ERROR,
      response.status,
    );
  }

  return machineRunSnapshotSchema.parse(await response.json());
}

export async function pollMachineRun(
  context: ServiceContext,
  machineId: string,
  machineRunId: string,
  created: MachineRunSnapshot,
  deadline: number,
  onText: (text: string) => void,
): Promise<string> {
  let snapshot = created;

  onText(snapshot.text);

  while (snapshot.state === "pending" || snapshot.state === "running") {
    if (Date.now() >= deadline) {
      await callMachineRun(context, machineId, `/cancel/${machineRunId}`).catch(() => undefined);
      throw new AssistantError(
        "Machine execution exceeded its deadline",
        ErrorType.PROVIDER_ERROR,
        504,
      );
    }

    const runId = context.executionRunId;
    const run = runId
      ? await context.repositories.get(ConversationRunRepository).getById(runId)
      : null;

    if (run?.cancellationRequestedAt || run?.status === "cancelled") {
      await callMachineRun(context, machineId, `/cancel/${machineRunId}`).catch(() => undefined);
      throw new AssistantError("Machine execution was cancelled", ErrorType.CONFLICT_ERROR, 409);
    }

    await abortableDelay(MACHINE_RUN_POLL_INTERVAL_MS);
    snapshot = await parseMachineSnapshot(
      await callMachineRun(context, machineId, `/read/${machineRunId}`),
    );
    onText(snapshot.text);
  }

  if (snapshot.state !== "completed") {
    throw new AssistantError(
      snapshot.error ?? "Machine execution did not complete",
      ErrorType.PROVIDER_ERROR,
    );
  }

  return snapshot.text;
}
