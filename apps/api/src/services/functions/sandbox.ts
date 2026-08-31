import {
  sandboxRunEventSchema,
  sandboxPromptStrategySchema,
  type ExecuteSandboxRunPayload,
  type SandboxRunEvent,
  type SandboxModelSettings,
  type SandboxPromptStrategy,
  type SandboxTaskType,
} from "@ngriffin_uk/polychat-schemas";

import {
  buildSandboxEventToolResponse,
  buildSandboxPlanToolResponse,
  buildSandboxResultToolResponse,
} from "~/lib/chat/messages/sandbox-messages";
import { executeSandboxRunStream } from "~/services/apps/sandbox/execute-stream";
import type { IFunctionResponse, IRequest } from "~/types";

import type { ApiToolDefinition } from "../../types/functions";
import { run_sandbox_task as run_sandbox_taskDescriptor } from "./definitions/sandbox";
import { resolveRequestProjectId } from "./request-context";

interface SandboxFunctionArgs {
  repo: string;
  task: string;
  taskType?: SandboxTaskType;
  promptStrategy?: string;
  shouldCommit?: boolean;
  timeoutSeconds?: number;
  installationId?: number;
}

interface SandboxRunStreamResult {
  runId: string;
  finalEvent?: SandboxRunEvent;
  lastEvent?: SandboxRunEvent;
}

function parsePromptStrategy(value: string | undefined): SandboxPromptStrategy | undefined {
  const parsed = sandboxPromptStrategySchema.safeParse(
    typeof value === "string" ? value.trim() : undefined,
  );

  return parsed.success ? parsed.data : undefined;
}

function parseInstallationId(args: SandboxFunctionArgs): number | undefined {
  return typeof args.installationId === "number" ? args.installationId : undefined;
}

function getSandboxRequestOptions(request: IRequest) {
  const sandboxOptions = request.request?.options?.sandbox;

  return sandboxOptions && typeof sandboxOptions === "object" ? sandboxOptions : undefined;
}

function pickNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getSandboxModelSettings(request: IRequest): SandboxModelSettings | undefined {
  const body = request.request;
  const sandboxOptions = getSandboxRequestOptions(request);
  const reasoningEffort = body?.reasoning?.effort ?? body?.reasoning_effort;
  const settings: SandboxModelSettings = {
    temperature: pickNumber(body?.temperature),
    top_p: pickNumber(body?.top_p),
    top_k: pickNumber(body?.top_k),
    max_tokens: pickNumber(body?.max_tokens),
    presence_penalty: pickNumber(body?.presence_penalty),
    frequency_penalty: pickNumber(body?.frequency_penalty),
    reasoning_effort: reasoningEffort,
    reasoning: reasoningEffort ? { effort: reasoningEffort } : undefined,
    verbosity: body?.verbosity,
    ...sandboxOptions?.modelSettings,
  };

  const hasSetting = Object.values(settings).some((value) => value !== undefined);

  return hasSetting ? settings : undefined;
}

async function executeSandboxFunction(params: {
  request: IRequest;
  args: SandboxFunctionArgs;
  taskType: SandboxTaskType;
  forceShouldCommit?: boolean;
  emitToolResult?: (response: IFunctionResponse) => Promise<void> | void;
}): Promise<IFunctionResponse> {
  const { request, args, taskType, forceShouldCommit, emitToolResult } = params;

  if (!request.context || !request.user) {
    throw new Error("User context is required for sandbox execution");
  }

  const sandboxOptions = getSandboxRequestOptions(request);
  const repo = sandboxOptions?.repo || args.repo;

  if (!repo) {
    throw new Error("Repository is required for sandbox execution");
  }

  const installationId = sandboxOptions?.installationId ?? parseInstallationId(args);

  if (!installationId) {
    throw new Error("Sandbox GitHub installation is required for sandbox execution");
  }

  const payload: ExecuteSandboxRunPayload = {
    installationId,
    repo,
    task: args.task,
    taskType,
    model: sandboxOptions?.model,
    promptStrategy: parsePromptStrategy(sandboxOptions?.promptStrategy || args.promptStrategy),
    shouldCommit:
      typeof forceShouldCommit === "boolean"
        ? forceShouldCommit
        : (sandboxOptions?.shouldCommit ?? args.shouldCommit),
    timeoutSeconds: sandboxOptions?.timeoutSeconds ?? args.timeoutSeconds,
    modelSettings: getSandboxModelSettings(request),
  };

  const response = await executeSandboxRunStream({
    env: request.env,
    context: request.context,
    user: request.user,
    payload,
    projectId: resolveRequestProjectId(request) ?? undefined,
    conversationId: request.request?.completion_id,
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(`Sandbox run error (${response.status}): ${errorText.slice(0, 500)}`);
  }

  const runStream = await consumeSandboxRunStream(response, emitToolResult);
  const finalEvent = runStream.finalEvent;

  if (!finalEvent) {
    throw new Error("Sandbox run stream ended before a terminal event");
  }

  const status =
    finalEvent.type === "run_completed"
      ? "completed"
      : finalEvent.type === "run_cancelled"
        ? "cancelled"
        : finalEvent.type === "run_failed"
          ? "failed"
          : "completed";

  if (status === "failed") {
    return buildSandboxResultToolResponse({
      runId: runStream.runId,
      repo,
      task: args.task,
      taskType,
      model: payload.model,
      status,
      updatedAt: finalEvent?.timestamp ?? runStream.lastEvent?.timestamp,
      completedAt: finalEvent?.completedAt ?? finalEvent?.timestamp,
      error: finalEvent?.error || "Sandbox run failed",
      result: finalEvent?.result,
    });
  }

  return buildSandboxResultToolResponse({
    runId: runStream.runId,
    repo,
    task: args.task,
    taskType,
    model: payload.model,
    status,
    updatedAt: finalEvent?.timestamp ?? runStream.lastEvent?.timestamp,
    completedAt: finalEvent?.completedAt ?? finalEvent?.timestamp,
    error: finalEvent?.error,
    result: finalEvent?.result,
  });
}

async function consumeSandboxRunStream(
  response: Response,
  emitToolResult?: (response: IFunctionResponse) => Promise<void> | void,
): Promise<SandboxRunStreamResult> {
  const runId = response.headers.get("X-Sandbox-Run-Id")?.trim();

  if (!runId) {
    throw new Error("Sandbox run stream did not return a run id");
  }

  if (!response.body) {
    throw new Error("Sandbox run stream response body is empty");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalEvent: SandboxRunEvent | undefined;
  let lastEvent: SandboxRunEvent | undefined;

  const handleEvent = async (event: SandboxRunEvent) => {
    lastEvent = event;
    const planResponse = buildSandboxPlanToolResponse({ runId, event });

    if (planResponse) {
      await emitToolResult?.(planResponse);
    }

    await emitToolResult?.(buildSandboxEventToolResponse(event));
    if (
      event.type === "run_completed" ||
      event.type === "run_failed" ||
      event.type === "run_cancelled"
    ) {
      finalEvent = event;
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      buffer += decoder.decode(value, { stream: true });
      buffer = await parseSandboxSseBuffer(buffer, handleEvent);
    }

    if (buffer.trim()) {
      await parseSandboxSseBuffer(`${buffer}\n\n`, handleEvent);
    }
  } finally {
    reader.releaseLock();
  }

  return { runId, finalEvent, lastEvent };
}

async function parseSandboxSseBuffer(
  buffer: string,
  onEvent: (event: SandboxRunEvent) => Promise<void>,
): Promise<string> {
  const chunks = buffer.split("\n\n");
  const rest = chunks.pop() || "";

  for (const chunk of chunks) {
    const dataLines = chunk
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice(6));

    if (dataLines.length === 0) {
      continue;
    }

    const data = dataLines.join("\n").trim();

    if (!data || data === "[DONE]") {
      continue;
    }

    const parsedJson = JSON.parse(data);
    const parsedEvent = sandboxRunEventSchema.safeParse(parsedJson);

    if (!parsedEvent.success) {
      continue;
    }

    await onEvent(parsedEvent.data);
  }

  return rest;
}

const READ_ONLY_TASK_TYPES = new Set<SandboxTaskType>(["code-review", "test-suite"]);

export const run_sandbox_task: ApiToolDefinition = {
  ...run_sandbox_taskDescriptor,
  execute: async (args, context) => {
    const typedArgs = args as SandboxFunctionArgs;
    const taskType = typedArgs.taskType ?? "feature-implementation";

    return executeSandboxFunction({
      request: context.request,
      args: typedArgs,
      taskType,
      forceShouldCommit: READ_ONLY_TASK_TYPES.has(taskType) ? false : undefined,
      emitToolResult: context.emitToolResult,
    });
  },
};
