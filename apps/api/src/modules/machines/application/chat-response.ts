import { extractTextFromMessageContent } from "@ngriffin_uk/polychat-ai-providers";
import {
  agentRuntimeVendorSchema,
  machineRunSnapshotSchema,
  machineRunRequestSchema,
  modelRuntimeVendorSchema,
  teammateRunConfigurationSchema,
  type MachineRunRequest,
  type MachineRunSnapshot,
  type ModelConfigItem,
} from "@ngriffin_uk/polychat-schemas";
import {
  abortableDelay,
  encodeServerSentEvent,
  encodeServerSentEventDone,
  generateId,
} from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { ChatCompletionParameters } from "~/types";

import { callMachineRun } from "./runs";

const MACHINE_RUN_POLL_INTERVAL_MS = 1000;
const MACHINE_RUN_MAX_DURATION_MS = 10 * 60 * 1000;

function machineMessages(
  messages: ChatCompletionParameters["messages"],
): MachineRunRequest["messages"] {
  return (messages ?? []).flatMap((message) => {
    if (message.role !== "system" && message.role !== "user" && message.role !== "assistant") {
      return [];
    }

    const content = extractTextFromMessageContent(message.content);

    return content ? [{ role: message.role, content }] : [];
  });
}

async function parseMachineSnapshot(response: Response) {
  if (!response.ok) {
    throw new AssistantError(
      `Machine execution failed (${response.status})`,
      ErrorType.PROVIDER_ERROR,
      response.status,
    );
  }

  return machineRunSnapshotSchema.parse(await response.json());
}

async function machineRunDeadline(params: ChatCompletionParameters): Promise<number> {
  const runId = params.context?.executionRunId;
  const run = runId ? await params.context?.repositories.conversationRuns.getById(runId) : null;
  const configuration = teammateRunConfigurationSchema.safeParse(run?.resolvedConfiguration);
  const configuredDeadline = configuration.success
    ? Date.parse(configuration.data.deadline ?? "")
    : NaN;

  return Number.isFinite(configuredDeadline)
    ? Math.min(configuredDeadline, Date.now() + MACHINE_RUN_MAX_DURATION_MS)
    : Date.now() + MACHINE_RUN_MAX_DURATION_MS;
}

export async function executeMachineChatResponse(
  params: ChatCompletionParameters,
  model: ModelConfigItem & { machineId: string },
): Promise<{ response: string } | ReadableStream<Uint8Array>> {
  const context = params.context;

  if (!context?.user) {
    throw new AssistantError(
      "Machine execution requires an authenticated service context",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  const messages = machineMessages(params.messages);
  const continuation = params.delegation_context?.continuation;
  let request: MachineRunRequest;

  if (!params.completion_id) {
    throw new AssistantError("Machine execution requires a conversation", ErrorType.PARAMS_ERROR);
  }

  if (model.agent) {
    const bindingConversationId =
      continuation?.bindingConversationId ?? params.delegation_context?.rootConversationId;

    if (!continuation || !bindingConversationId) {
      throw new AssistantError(
        "A background native agent needs an existing compatible session binding",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    request = {
      id: generateId(),
      kind: "agent",
      driver: agentRuntimeVendorSchema.parse(model.matchingModel),
      conversationId: params.completion_id,
      bindingConversationId,
      continuationMode: continuation.mode === "resume" ? "resume" : "fresh",
      messages,
      selectedModel: null,
      reasoningEffort: params.reasoning_effort ?? params.reasoning?.effort ?? null,
      permissionMode: params.permission_mode ?? "auto_accept_edits",
    };
  } else {
    request = {
      id: generateId(),
      vendor: modelRuntimeVendorSchema.parse(model.provider),
      nativeModelId: model.matchingModel,
      conversationId: params.completion_id,
      messages,
    };
  }

  const parsedRequest = machineRunRequestSchema.parse(request);
  const created = await parseMachineSnapshot(
    await callMachineRun(context, model.machineId, "/create", parsedRequest),
  );
  const deadline = await machineRunDeadline(params);
  const poll = (onText: (text: string) => void) =>
    pollMachineRun(context, model.machineId, parsedRequest.id, created, deadline, onText);

  if (!params.stream) {
    return { response: await poll(() => undefined) };
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let sent = 0;

      try {
        await poll((text) => {
          if (text.length > sent) {
            controller.enqueue(
              encodeServerSentEvent({
                type: "response.output_text.delta",
                delta: text.slice(sent),
              }),
            );
            sent = text.length;
          }
        });
        controller.enqueue(encodeServerSentEventDone());
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

async function pollMachineRun(
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
    const run = runId ? await context.repositories.conversationRuns.getById(runId) : null;

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
