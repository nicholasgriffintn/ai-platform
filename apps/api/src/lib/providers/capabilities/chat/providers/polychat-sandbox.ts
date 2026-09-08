import {
  sandboxRequestOptionsSchema,
  sandboxRunEventSchema,
  type SandboxRunEvent,
} from "@ngriffin_uk/polychat-schemas";

import { executeSandboxRunStream } from "~/services/apps/sandbox/execute-stream";
import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { extractTextFromMessageContent } from "~/utils/messages";

import type { AIProvider } from "./base";

async function readRunResult(response: Response): Promise<{
  runId: string;
  event: SandboxRunEvent;
}> {
  const runId = response.headers.get("X-Sandbox-Run-Id")?.trim();

  if (!runId || !response.body) {
    throw new AssistantError("Sandbox run did not return a stream", ErrorType.PROVIDER_ERROR);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let terminalEvent: SandboxRunEvent | undefined;

  const readChunk = (chunk: string) => {
    for (const eventChunk of chunk.split("\n\n")) {
      const data = eventChunk
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice(6))
        .join("\n")
        .trim();

      if (!data || data === "[DONE]") {
        continue;
      }

      const parsed = sandboxRunEventSchema.safeParse(JSON.parse(data));

      if (
        parsed.success &&
        (parsed.data.type === "run_completed" ||
          parsed.data.type === "run_failed" ||
          parsed.data.type === "run_cancelled")
      ) {
        terminalEvent = parsed.data;
      }
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";
      readChunk(chunks.join("\n\n"));
    }

    readChunk(`${buffer}\n\n`);
  } finally {
    reader.releaseLock();
  }

  if (!terminalEvent) {
    throw new AssistantError(
      "Sandbox run ended without a terminal event",
      ErrorType.PROVIDER_ERROR,
    );
  }

  return { runId, event: terminalEvent };
}

export class PolychatSandboxProvider implements AIProvider {
  readonly name = "polychat-sandbox";
  readonly supportsStreaming = false;

  async getResponse(params: ChatCompletionParameters) {
    const user = params.context?.user;
    const options = sandboxRequestOptionsSchema.safeParse(params.options?.sandbox);
    const task = extractTextFromMessageContent(params.messages?.at(-1)?.content);

    if (!user?.id || !options.success || !options.data.enabled || !options.data.repo) {
      throw new AssistantError(
        "Choose a connected repository before starting the coding run",
        ErrorType.PARAMS_ERROR,
      );
    }

    if (!options.data.installationId) {
      throw new AssistantError(
        "A connected repository is required before starting the coding run",
        ErrorType.PARAMS_ERROR,
      );
    }

    const response = await executeSandboxRunStream({
      env: params.env,
      context: params.context!,
      user,
      payload: {
        installationId: options.data.installationId,
        repo: options.data.repo,
        task,
        taskType: options.data.taskType,
        model: options.data.model,
        promptStrategy: options.data.promptStrategy,
        deliveryPolicy: options.data.deliveryPolicy,
        shouldCommit: options.data.shouldCommit,
        environmentSetup: options.data.environmentSetup,
        timeoutSeconds: options.data.timeoutSeconds,
        modelSettings: {
          temperature: params.temperature,
          top_p: params.top_p,
          top_k: params.top_k,
          max_tokens: params.max_tokens,
          presence_penalty: params.presence_penalty,
          frequency_penalty: params.frequency_penalty,
          reasoning_effort: params.reasoning_effort,
          reasoning: params.reasoning,
          verbosity: params.verbosity,
        },
      },
      projectId:
        typeof params.metadata?.project_id === "string" ? params.metadata.project_id : undefined,
      conversationId: params.completion_id,
    });
    const result = await readRunResult(response);
    const failed = result.event.type !== "run_completed";
    const summary = result.event.result?.summary?.trim();

    return {
      response:
        summary ||
        (failed ? (result.event.error ?? "The coding run failed") : "The coding run completed."),
      model: "polychat-sandbox",
      provider: this.name,
      data: {
        sandboxRunId: result.runId,
        status: result.event.type,
        result: result.event.result,
      },
      status: failed ? "failed" : "completed",
    };
  }
}
