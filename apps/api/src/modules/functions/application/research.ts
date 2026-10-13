import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import { handleResearchTask, startResearchTask } from "~/modules/research/application/task";
import type { ResearchOptions } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";

import {
  RESEARCH_DEPTHS,
  RESEARCH_FORMATS,
  research as researchDescriptor,
  type ResearchDepth,
} from "./definitions/research";

const PARALLEL_PROCESSORS: Record<ResearchDepth, string> = {
  quick: "base",
  standard: "pro",
  deep: "ultra",
};

const EXA_MODELS: Record<ResearchDepth, string> = {
  quick: "exa-research",
  standard: "exa-research",
  deep: "exa-research-pro",
};

const DEFAULT_POLL_INTERVAL_MS = 5000;

const researchArgsSchema = z.object({
  input: z.string().trim().min(1, "Provide a research brief in input"),
  depth: z.enum(RESEARCH_DEPTHS).default("standard"),
  format: z.enum(RESEARCH_FORMATS).default("report"),
  output_description: z.string().trim().optional(),
  provider: z.enum(["parallel", "exa"]).default("parallel"),
});

type ResearchArgs = z.infer<typeof researchArgsSchema>;

export function researchOptionsFor(args: ResearchArgs): ResearchOptions {
  if (args.provider === "exa") {
    return { model: EXA_MODELS[args.depth] };
  }

  return {
    processor: PARALLEL_PROCESSORS[args.depth],
    task_spec: {
      output_schema: {
        type: args.format === "data" ? "auto" : "text",
        ...(args.output_description ? { description: args.output_description } : {}),
      },
    },
  };
}

function parseResearchArgs(args: unknown): ResearchArgs {
  const parsed = researchArgsSchema.safeParse(args ?? {});

  if (!parsed.success) {
    throw new AssistantError(
      parsed.error.issues.map((issue) => issue.message).join("; "),
      ErrorType.PARAMS_ERROR,
    );
  }

  return parsed.data;
}

export const research: ApiToolDefinition = {
  ...researchDescriptor,
  execute: async (args, context) => {
    const req = context.request;
    const completion_id = context.completionId;
    const parsed = parseResearchArgs(args);
    const options = researchOptionsFor(parsed);
    const shouldWait = req.request?.platform !== "tool-run";

    if (shouldWait) {
      const response = await handleResearchTask({
        env: req.env,
        user: req.user,
        input: parsed.input,
        provider: parsed.provider,
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
      input: parsed.input,
      provider: parsed.provider,
      options,
    });

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
          pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
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
