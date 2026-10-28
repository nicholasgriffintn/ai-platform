import type {
  AgentHarnessEvent,
  AgentHarnessEventRecord,
  MachineRunRequest,
  MachineRunSnapshot,
} from "@ngriffin_uk/polychat-schemas";

export const MAX_MACHINE_RUN_RECORDS = 5_000;

export function isAgentRunRequest(request: MachineRunRequest): boolean {
  return "kind" in request && request.kind === "agent";
}

export function appendRunRecords(
  records: readonly AgentHarnessEventRecord[],
  events: readonly AgentHarnessEvent[],
): AgentHarnessEventRecord[] {
  return [
    ...records,
    ...events.map((event, index) => ({ seq: records.length + index + 1, event })),
  ];
}

export function settlementEvent(
  runId: string,
  snapshot: Pick<MachineRunSnapshot, "state" | "error">,
): AgentHarnessEvent | null {
  switch (snapshot.state) {
    case "completed":
      return { type: "operation-settled", operationId: runId, status: "done" };
    case "failed":
    case "cancelled":
      return {
        type: "operation-settled",
        operationId: runId,
        status: "unanswered",
        reason:
          snapshot.error ??
          (snapshot.state === "cancelled" ? "The run was cancelled." : "The machine stopped."),
      };
    default:
      return null;
  }
}

export function recordsAfter(
  records: readonly AgentHarnessEventRecord[],
  after: number,
): AgentHarnessEventRecord[] {
  return records.filter((record) => record.seq > after);
}
