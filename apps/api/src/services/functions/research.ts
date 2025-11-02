import type { ConversationManager } from "~/lib/conversationManager";
import {
  handleResearchTask,
  startResearchTask,
} from "~/services/research/task";
import type {
  IFunction,
  IRequest,
  ResearchOptions,
  ParallelTaskSpec,
  ResearchProviderName,
} from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

function coercePollingOptions(
  args: any,
): ResearchOptions["polling"] | undefined {
  const interval =
    typeof args?.poll_interval_ms === "number"
      ? Math.floor(args.poll_interval_ms)
      : undefined;
  const timeout =
    typeof args?.poll_timeout_seconds === "number"
      ? Math.floor(args.poll_timeout_seconds)
      : undefined;
  const maxAttempts =
    typeof args?.max_poll_attempts === "number"
      ? Math.floor(args.max_poll_attempts)
      : undefined;

  if (
    interval === undefined &&
    timeout === undefined &&
    maxAttempts === undefined
  ) {
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
    try {
      const parsed = JSON.parse(args.task_spec_json);
      return parsed;
    } catch (error) {
      throw new AssistantError(
        "task_spec_json must be valid JSON",
        ErrorType.PARAMS_ERROR,
        400,
        {
          original: error instanceof Error ? error.message : String(error),
        },
      );
    }
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

export const research: IFunction = {
  name: "research",
  description:
    "Executes deep web research via Parallel Tasks. Ideal for market analysis, due diligence, and multi-source synthesis.",
  type: "premium",
  costPerCall: 3,
  parameters: {
    type: "object",
    properties: {
      input: {
        type: "string",
        description:
          "Plain-text research brief. Provide this or structured_input.",
      },
      structured_input: {
        type: "object",
        description:
          "Structured input payload matching a Task API input schema. Overrides input when provided.",
      },
      provider: {
        type: "string",
        description:
          "Optional research provider identifier. Defaults to 'parallel'.",
        enum: ["parallel"],
      },
      processor: {
        type: "string",
        description:
          "Parallel processor to use (e.g. 'ultra', 'pro', 'core', 'base'). Defaults to ultra.",
      },
      output_mode: {
        type: "string",
        description:
          "Convenience helper for output schema. Supports 'auto' or 'text'. Ignored when task_spec_json is provided.",
        enum: ["auto", "text"],
      },
      output_description: {
        type: "string",
        description:
          "Optional description to guide text outputs when output_mode is 'text'.",
      },
      task_spec_json: {
        type: "string",
        description:
          "Full Task API task_spec payload as JSON. Overrides output_mode/output_description when provided.",
      },
      enable_events: {
        type: "boolean",
        description:
          "Enable Parallel event streaming for richer internal telemetry.",
        default: false,
      },
      poll_interval_ms: {
        type: "number",
        description:
          "Polling interval in milliseconds when waiting for task completion. Defaults to 5000.",
      },
      poll_timeout_seconds: {
        type: "number",
        description:
          "Timeout in seconds for each result poll request. Defaults to 25.",
      },
      max_poll_attempts: {
        type: "number",
        description:
          "Maximum number of poll attempts before timing out. Defaults to 120 (~10 minutes at 5s interval).",
      },
      metadata: {
        type: "object",
        description:
          "Arbitrary metadata object to forward to Parallel. Useful for tagging or auditing.",
      },
      wait_for_completion: {
        type: "boolean",
        description:
          "Set to false to return immediately with a task handle and poll for results separately. Defaults to true for chats, false for dynamic apps.",
      },
    },
  },
  function: async (
    completion_id: string,
    args: any,
    req: IRequest,
    _app_url?: string,
    _conversationManager?: ConversationManager,
  ) => {
    const {
      input,
      structured_input,
      provider,
      processor,
      enable_events,
      metadata,
    } = args || {};

    const payload =
      structured_input !== undefined && structured_input !== null
        ? structured_input
        : input;

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

    if (typeof processor === "string" && processor.trim().length > 0) {
      options.processor = processor;
    }

    const polling = coercePollingOptions(args);
    if (polling) {
      options.polling = polling;
    }

    if (typeof enable_events === "boolean") {
      options.enable_events = enable_events;
    }

    if (metadata && typeof metadata === "object") {
      options.metadata = metadata as Record<string, unknown>;
    }

    const taskSpec = buildTaskSpec(args);
    if (taskSpec) {
      options.task_spec = taskSpec;
    }

    const providerName =
      typeof provider === "string" && provider.trim().length > 0
        ? (provider.trim().toLowerCase() as ResearchProviderName)
        : undefined;

    const waitForCompletionArg =
      typeof args?.wait_for_completion === "boolean"
        ? args.wait_for_completion
        : undefined;
    const isDynamicApp = req.request?.platform === "dynamic-apps";
    const shouldWait =
      waitForCompletionArg !== undefined ? waitForCompletionArg : !isDynamicApp;

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
          id: handle.run.run_id,
          type: "research",
          status: "in_progress",
          pollIntervalMs: pollInterval,
          poll: {
            url: `/apps/retrieval/research/${handle.run.run_id}`,
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
