import { handleResearchTask, startResearchTask } from "~/services/research/task";
import type { ResearchOptions, ParallelTaskSpec, ResearchProviderName } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

import type { ApiToolDefinition } from "../../types/functions";
import { safeParseJson } from "../../utils/json";
import { research as researchDescriptor } from "./definitions/research";

function coercePollingOptions(args: any): ResearchOptions["polling"] | undefined {
  const interval =
    typeof args?.poll_interval_ms === "number" ? Math.floor(args.poll_interval_ms) : undefined;
  const timeout =
    typeof args?.poll_timeout_seconds === "number"
      ? Math.floor(args.poll_timeout_seconds)
      : undefined;
  const maxAttempts =
    typeof args?.max_poll_attempts === "number" ? Math.floor(args.max_poll_attempts) : undefined;

  if (interval === undefined && timeout === undefined && maxAttempts === undefined) {
    return undefined;
  }

  return {
    interval_ms: interval,
    timeout_seconds: timeout,
    max_attempts: maxAttempts,
  };
}

function buildTaskSpec(args: any): ParallelTaskSpec | undefined {
  if (typeof args?.task_spec_json === "string") {
    const parsed = safeParseJson(args.task_spec_json);

    return parsed;
  }

  if (typeof args?.output_mode === "string") {
    const mode = args.output_mode.toLowerCase();

    if (mode === "auto" || mode === "text") {
      return {
        output_schema: {
          type: mode as "auto" | "text",
          description: args.output_description,
        },
      };
    }
  }

  return undefined;
}

export const research: ApiToolDefinition = {
  ...researchDescriptor,
  execute: async (args, context) => {
    const req = context.request;
    const completion_id = context.completionId;

    const {
      input,
      structured_input,
      provider,
      processor,
      model,
      enable_events,
      metadata,
      output_schema_json,
    } = args || {};

    const payload =
      structured_input !== undefined && structured_input !== null ? structured_input : input;

    if (
      payload === undefined ||
      payload === null ||
      (typeof payload === "string" && payload.trim().length === 0)
    ) {
      throw new AssistantError(
        "You must provide either input or structured_input",
        ErrorType.PARAMS_ERROR,
      );
    }

    const options: ResearchOptions = {};

    // Parallel-specific options
    if (typeof processor === "string" && processor.trim().length > 0) {
      options.processor = processor;
    }

    const taskSpec = buildTaskSpec(args);

    if (taskSpec) {
      options.task_spec = taskSpec;
    }

    if (typeof enable_events === "boolean") {
      options.enable_events = enable_events;
    }

    // Exa-specific options
    if (typeof model === "string" && model.trim().length > 0) {
      options.model = model;
    }

    if (typeof output_schema_json === "string") {
      const parsed = safeParseJson(output_schema_json);

      if (!parsed) {
        throw new AssistantError("Invalid output_schema_json provided", ErrorType.PARAMS_ERROR);
      }

      options.exa_spec = {
        output_schema: parsed,
      };
    }

    // Common options
    const polling = coercePollingOptions(args);

    if (polling) {
      options.polling = polling;
    }

    if (metadata && typeof metadata === "object") {
      options.metadata = metadata as Record<string, unknown>;
    }

    const providerName =
      typeof provider === "string" && provider.trim().length > 0
        ? (provider.trim().toLowerCase() as ResearchProviderName)
        : undefined;

    const waitForCompletionArg =
      typeof args?.wait_for_completion === "boolean" ? args.wait_for_completion : undefined;
    const isToolRun = req.request?.platform === "tool-run";
    const shouldWait = waitForCompletionArg !== undefined ? waitForCompletionArg : !isToolRun;

    if (shouldWait) {
      const response = await handleResearchTask({
        env: req.env,
        user: req.user,
        input: payload,
        provider: providerName,
        options,
      });

      return {
        name: "research",
        status: response.status,
        content: response.content,
        data: {
          ...response.data,
          completion_id,
        },
      };
    }

    const handle = await startResearchTask({
      env: req.env,
      user: req.user,
      input: payload,
      provider: providerName,
      options,
    });

    const pollInterval =
      options.polling?.interval_ms && options.polling.interval_ms >= 500
        ? options.polling.interval_ms
        : 5000;

    const runId =
      "run_id" in handle.run
        ? handle.run.run_id
        : "research_id" in handle.run
          ? handle.run.research_id
          : "";

    return {
      name: "research",
      status: "in_progress",
      content: "Research task started",
      data: {
        provider: handle.provider,
        run: handle.run,
        options,
        completion_id,
        asyncInvocation: {
          provider: handle.provider,
          id: runId,
          type: "research",
          status: "in_progress",
          pollIntervalMs: pollInterval,
          poll: {
            url: `/apps/retrieval/research/${runId}`,
            method: "GET",
          },
          context: {
            provider: handle.provider,
          },
        },
      },
    };
  },
};
