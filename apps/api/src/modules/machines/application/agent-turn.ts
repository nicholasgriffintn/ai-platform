import {
  machineRunEventsSchema,
  machineRunRequestSchema,
  type MachineRunRequest,
} from "@ngriffin_uk/polychat-schemas";
import { abortableDelay } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  followHarnessRecords,
  type HarnessApprovalReference,
} from "~/modules/agents/application/harness-stream";
import { streamHarnessRecords } from "~/modules/agents/application/harness-turn";
import { requireActiveExecutionRun } from "~/modules/responses/application/runs/execution-authority";

import { parseMachineSnapshot } from "./machine-run-polling";
import { callMachineRun } from "./runs";

const EVENT_POLL_INTERVAL_MS = 250;
const TERMINAL_STATES = new Set(["completed", "failed", "cancelled"]);

export interface MachineAgentTurn {
  context: ServiceContext;
  machineId: string;
  conversationId: string;
  harnessName: string;
  request?: MachineRunRequest;
  resume?: HarnessApprovalReference & { approved: boolean };
}

function openEventStream(
  turn: MachineAgentTurn,
  after: number,
  signal: AbortSignal,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let cursor = after;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      for (;;) {
        if (signal.aborted) {
          controller.close();

          return;
        }

        const response = await callMachineRun(
          turn.context,
          turn.machineId,
          `/events/${encodeURIComponent(turn.conversationId)}/${cursor}`,
        );

        if (!response.ok) {
          throw new AssistantError(
            "The machine run is no longer available",
            ErrorType.PROVIDER_ERROR,
            response.status,
          );
        }

        const snapshot = machineRunEventsSchema.parse(await response.json());

        if (snapshot.records.length > 0) {
          cursor = snapshot.records.at(-1)?.seq ?? cursor;
          controller.enqueue(
            encoder.encode(
              snapshot.records.map((record) => `${JSON.stringify(record)}\n`).join(""),
            ),
          );

          return;
        }

        if (TERMINAL_STATES.has(snapshot.state)) {
          controller.close();

          return;
        }

        await abortableDelay(EVENT_POLL_INTERVAL_MS, signal).catch(() => undefined);
      }
    },
  });
}

export async function startMachineAgentTurn(
  turn: MachineAgentTurn,
): Promise<ReadableStream<Uint8Array>> {
  let after = 0;
  let operationId: string | undefined;

  if (turn.resume) {
    await callMachineRun(turn.context, turn.machineId, "/decide", {
      conversationId: turn.conversationId,
      approvalId: turn.resume.approvalId,
      approved: turn.resume.approved,
    });
    after = turn.resume.seq;
  } else if (turn.request) {
    const request = machineRunRequestSchema.parse(turn.request);

    await parseMachineSnapshot(
      await callMachineRun(turn.context, turn.machineId, "/create", request),
    );
    operationId = request.id;
  } else {
    throw new AssistantError("A machine agent turn needs a message", ErrorType.PARAMS_ERROR);
  }

  const reading = new AbortController();
  const cancel = () =>
    operationId
      ? callMachineRun(turn.context, turn.machineId, `/cancel/${operationId}`).catch(
          () => undefined,
        )
      : Promise.resolve(undefined);

  return streamHarnessRecords({
    records: followHarnessRecords(
      async (cursor) => openEventStream(turn, cursor, reading.signal),
      after,
      reading.signal,
    ),
    release: () => reading.abort(),
    harnessName: turn.harnessName,
    ...(operationId ? { operationId } : {}),
    checkIn: async () => {
      try {
        await requireActiveExecutionRun(turn.context);
      } catch (error) {
        await cancel();
        throw error;
      }
    },
  });
}
