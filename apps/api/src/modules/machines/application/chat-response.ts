import { extractTextFromMessageContent } from "@ngriffin_uk/polychat-ai-providers";
import {
  agentRuntimeVendorSchema,
  machineRunRequestSchema,
  modelRuntimeVendorSchema,
  teammateRunConfigurationSchema,
  type AgentRuntimeVendor,
  type MachineRunMessages,
  type MachineRunRequest,
  type ModelConfigItem,
} from "@ngriffin_uk/polychat-schemas";
import {
  encodeServerSentEvent,
  encodeServerSentEventDone,
  generateId,
} from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import {
  withExecutionRunContext,
  type ServiceContext,
} from "~/infrastructure/context/serviceContext";
import {
  collectHarnessProviderStream,
  readHarnessApprovalResolution,
} from "~/modules/agents/application/harness-stream";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import { parseMachineModelId } from "~/modules/machines/domain/model-id";
import { workPermissionMode } from "~/modules/machines/domain/work-permissions";
import { mintWorkRunAccess, workRunToolIds } from "~/modules/ports/mcp/application/work-access";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";
import type { ChatCompletionParameters } from "~/types";

import { startMachineAgentTurn } from "./agent-turn";
import { parseMachineSnapshot, pollMachineRun } from "./machine-run-polling";
import { callMachineRun } from "./runs";

function machineMessages(messages: ChatCompletionParameters["messages"]): MachineRunMessages {
  return (messages ?? []).flatMap((message) => {
    if (message.role !== "system" && message.role !== "user" && message.role !== "assistant") {
      return [];
    }

    const content = extractTextFromMessageContent(message.content);

    return content ? [{ role: message.role, content }] : [];
  });
}

async function machineRunDeadline(params: ChatCompletionParameters): Promise<number | undefined> {
  const runId = params.context?.executionRunId;
  const run = runId
    ? await params.context?.repositories.get(ConversationRunRepository).getById(runId)
    : null;
  const configuration = teammateRunConfigurationSchema.safeParse(run?.resolvedConfiguration);
  const configuredDeadline = configuration.success
    ? Date.parse(configuration.data.deadline ?? "")
    : NaN;

  return Number.isFinite(configuredDeadline) ? configuredDeadline : undefined;
}

async function workAccessFor(
  context: ServiceContext,
  params: ChatCompletionParameters,
  conversationId: string,
): Promise<{ workFolder: string | null; workToken: string | null }> {
  const projectId = params.metadata?.project_id;

  if (typeof projectId !== "string") {
    return { workFolder: null, workToken: null };
  }

  const workspaces = context.repositories.get(WorkspaceRepository);
  const project = await workspaces.getProject(projectId);
  const workspace = project?.workspace_id
    ? await workspaces.getWorkspace(project.workspace_id)
    : null;

  if (!workspace) {
    return { workFolder: null, workToken: null };
  }

  const run = context.executionRunId
    ? await context.repositories.get(ConversationRunRepository).getById(context.executionRunId)
    : null;

  return {
    workFolder: workspace.name.slice(0, 80),
    workToken: run?.teammateContextId
      ? await mintWorkRunAccess(context, {
          userId: context.requireUser().id,
          projectId,
          teammateContextId: run.teammateContextId,
          conversationId,
          toolIds: workRunToolIds(params.enabled_tools ?? []),
        })
      : null,
  };
}

async function agentTurnRequest(
  context: ServiceContext,
  params: ChatCompletionParameters,
  turn: { driver: AgentRuntimeVendor; conversationId: string; messages: MachineRunMessages },
): Promise<MachineRunRequest> {
  const continuation = params.delegation_context?.continuation;
  const workAccess = await workAccessFor(context, params, turn.conversationId);

  return {
    id: generateId(),
    kind: "agent",
    driver: turn.driver,
    conversationId: turn.conversationId,
    bindingConversationId:
      continuation?.bindingConversationId ??
      params.delegation_context?.rootConversationId ??
      turn.conversationId,
    continuationMode: continuation ? (continuation.mode === "resume" ? "resume" : "fresh") : "auto",
    ...workAccess,
    messages: turn.messages,
    selectedModel: null,
    reasoningEffort: params.reasoning_effort ?? params.reasoning?.effort ?? null,
    permissionMode: workAccess.workFolder
      ? workPermissionMode(params.autonomy_level)
      : (params.permission_mode ?? "auto_accept_edits"),
  };
}

export async function executeMachineChatResponse(
  params: ChatCompletionParameters,
  model: ModelConfigItem & { machineId: string },
): Promise<{ response: string } | ReadableStream<Uint8Array>> {
  const context =
    params.context && params.run_id
      ? withExecutionRunContext(params.context, params.run_id, params.run_attempt)
      : params.context;

  if (!context?.user) {
    throw new AssistantError(
      "Machine execution requires an authenticated service context",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  const messages = machineMessages(params.messages);

  if (!params.completion_id) {
    throw new AssistantError("Machine execution requires a conversation", ErrorType.PARAMS_ERROR);
  }

  if (model.agent) {
    const driver = agentRuntimeVendorSchema.parse(model.provider);
    const resume = readHarnessApprovalResolution(params.options);
    const stream = await startMachineAgentTurn({
      context,
      machineId: model.machineId,
      conversationId: params.completion_id,
      harnessName: model.name ?? driver,
      ...(resume
        ? { resume }
        : {
            request: await agentTurnRequest(context, params, {
              driver,
              conversationId: params.completion_id,
              messages,
            }),
          }),
    });

    if (params.stream) {
      return stream;
    }

    const collected = await collectHarnessProviderStream(stream);

    if (collected.error && !collected.response && collected.toolCalls.length === 0) {
      throw new AssistantError(collected.error, ErrorType.PROVIDER_ERROR);
    }

    return { response: collected.response };
  }

  const request: MachineRunRequest = {
    id: generateId(),
    vendor: modelRuntimeVendorSchema.parse(model.provider),
    nativeModelId: parseMachineModelId(model.matchingModel)?.nativeId ?? model.matchingModel,
    conversationId: params.completion_id,
    messages,
  };
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
