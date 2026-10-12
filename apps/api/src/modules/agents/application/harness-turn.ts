import {
  AGENT_HARNESS_DEFINITIONS,
  type AgentHarnessEventRecord,
  type AgentHarnessRpc,
  type HostedAgentHarnessId,
  type PermissionMode,
  type ReasoningEffort,
} from "@ngriffin_uk/polychat-schemas";
import {
  abortableDelay,
  encodeServerSentEvent,
  encodeServerSentEventDone,
  generateId,
} from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireActiveExecutionRun } from "~/modules/chat-runs/application/execution-authority";

import {
  agentHarnessSessionKey,
  harnessRecordToProviderChunks,
  readHarnessRecords,
  type HarnessApprovalReference,
} from "./harness-stream";
import { takeQueuedSteer } from "./queued-steer";

const CHECK_IN_INTERVAL_MS = 5_000;

export interface HostedHarnessTurn {
  context: ServiceContext;
  client: AgentHarnessRpc;
  harness: HostedAgentHarnessId;
  userId: number;
  conversationId: string;
  model: string;
  permissionMode: PermissionMode;
  input?: string;
  instructions?: string;
  reasoningEffort?: ReasoningEffort;
  resume?: HarnessApprovalReference & { approved: boolean };
}

export function streamHarnessRecords(params: {
  records: AsyncIterable<AgentHarnessEventRecord>;
  harnessName: string;
  operationId?: string;
  checkIn: () => Promise<void>;
  deadline: number;
  onExpired: () => Promise<void>;
  release?: () => void;
}): ReadableStream<Uint8Array> {
  const iterator = params.records[Symbol.asyncIterator]();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let pending = iterator.next();
      let inputTokens = 0;
      let outputTokens = 0;

      try {
        for (;;) {
          const next = await Promise.race([
            pending,
            abortableDelay(CHECK_IN_INTERVAL_MS).then(() => null),
          ]);

          if (next === null) {
            await params.checkIn();

            if (Date.now() >= params.deadline) {
              await params.onExpired();
              controller.enqueue(
                encodeServerSentEvent({
                  error: { message: `${params.harnessName} did not finish in time` },
                }),
              );
              break;
            }

            continue;
          }

          if (next.done) {
            break;
          }

          if (next.value.event.type === "usage") {
            inputTokens += next.value.event.inputTokens;
            outputTokens += next.value.event.outputTokens;
            controller.enqueue(
              encodeServerSentEvent({
                usage: {
                  prompt_tokens: inputTokens,
                  completion_tokens: outputTokens,
                  total_tokens: inputTokens + outputTokens,
                },
              }),
            );
            pending = iterator.next();
            continue;
          }

          const translated = harnessRecordToProviderChunks(next.value, {
            harnessName: params.harnessName,
            ...(params.operationId ? { operationId: params.operationId } : {}),
          });

          for (const chunk of translated.chunks) {
            controller.enqueue(encodeServerSentEvent(chunk));
          }

          if (translated.done) {
            break;
          }

          pending = iterator.next();
        }

        controller.enqueue(encodeServerSentEventDone());
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        params.release?.();
        await iterator.return?.();
      }
    },
  });
}

export async function startHostedHarnessTurn(
  turn: HostedHarnessTurn,
): Promise<ReadableStream<Uint8Array>> {
  const definition = AGENT_HARNESS_DEFINITIONS[turn.harness];
  const sessionKey = agentHarnessSessionKey(turn.userId, turn.conversationId);
  let operationId: string | undefined;
  let after: number;

  if (turn.resume) {
    await turn.client.answerHarnessApproval(turn.harness, {
      sessionKey,
      approvalId: turn.resume.approvalId,
      approved: turn.resume.approved,
    });
    after = turn.resume.seq;
  } else {
    const receipt = await turn.client.submitHarnessTurn(turn.harness, {
      sessionKey,
      userId: turn.userId,
      conversationId: turn.conversationId,
      operationId: generateId(),
      input: turn.input ?? "",
      model: turn.model,
      permissionMode: turn.permissionMode,
      whenBusy: "followUp",
      ...(turn.instructions ? { instructions: turn.instructions } : {}),
      ...(turn.reasoningEffort ? { reasoningEffort: turn.reasoningEffort } : {}),
    });

    operationId = receipt.operationId;
    after = receipt.after;
  }

  const events = await turn.client.readHarnessEvents(turn.harness, sessionKey, after);
  const reading = new AbortController();
  const abort = () =>
    turn.client.abortHarnessTurn(turn.harness, {
      sessionKey,
      ...(operationId ? { operationId } : {}),
    });

  return streamHarnessRecords({
    records: readHarnessRecords(events, reading.signal),
    release: () => reading.abort(),
    harnessName: definition.name,
    ...(operationId ? { operationId } : {}),
    deadline: Date.now() + definition.capabilities.maxTurnMinutes * 60_000,
    onExpired: abort,
    checkIn: async () => {
      try {
        await requireActiveExecutionRun(turn.context);
      } catch (error) {
        await abort().catch(() => undefined);
        throw error;
      }

      if (!definition.capabilities.steer) {
        return;
      }

      await takeQueuedSteer({
        context: turn.context,
        userId: turn.userId,
        conversationId: turn.conversationId,
        steer: async (text) => {
          const receipt = await turn.client.submitHarnessTurn(turn.harness, {
            sessionKey,
            userId: turn.userId,
            conversationId: turn.conversationId,
            operationId: generateId(),
            input: text,
            model: turn.model,
            permissionMode: turn.permissionMode,
            whenBusy: "steer",
          });

          return receipt.accepted;
        },
      }).catch(() => false);
    },
  });
}
