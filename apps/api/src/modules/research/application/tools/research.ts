import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import { resolveServiceContext } from "~/infrastructure/context/serviceContext";
import { describeOwnSources, findOwnSources } from "~/modules/research/application/grounding";
import { researchOptionsFor } from "~/modules/research/application/options";
import { handleResearchTask, startResearchTask } from "~/modules/research/application/task";
import { resolveRequestProjectId } from "~/modules/tools/application/request-context";
import type { ApiToolDefinition } from "~/types/functions";

import {
  RESEARCH_DEPTHS,
  RESEARCH_FORMATS,
  research as researchDescriptor,
} from "./definitions/research";

const DEFAULT_POLL_INTERVAL_MS = 5000;

const researchArgsSchema = z.object({
  input: z.string().trim().min(1, "Provide a research brief in input"),
  depth: z.enum(RESEARCH_DEPTHS).default("standard"),
  format: z.enum(RESEARCH_FORMATS).default("report"),
  output_description: z.string().trim().optional(),
  provider: z.enum(["parallel", "exa"]).default("parallel"),
  use_sources: z.boolean().default(true),
});

type ResearchArgs = z.infer<typeof researchArgsSchema>;

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
    const grounding =
      parsed.use_sources && req.user
        ? findOwnSources(
            resolveServiceContext(req),
            parsed.input,
            resolveRequestProjectId(req) ?? undefined,
          )
        : Promise.resolve(null);

    if (shouldWait) {
      const [response, ownSources] = await Promise.all([
        handleResearchTask({
          env: req.env,
          user: req.user,
          input: parsed.input,
          provider: parsed.provider,
          options,
        }),
        grounding,
      ]);

      return {
        name: "research",
        status: response.status,
        content:
          ownSources && typeof response.content === "string"
            ? `${response.content}\n\n${describeOwnSources(ownSources)}`
            : response.content,
        data: {
          ...response.data,
          ...(ownSources ? { ownSources } : {}),
          completion_id,
        },
      };
    }

    const [handle, ownSources] = await Promise.all([
      startResearchTask({
        env: req.env,
        user: req.user,
        input: parsed.input,
        provider: parsed.provider,
        options,
      }),
      grounding,
    ]);

    const runId =
      "run_id" in handle.run
        ? handle.run.run_id
        : "research_id" in handle.run
          ? handle.run.research_id
          : "";

    return {
      name: "research",
      status: "in_progress",
      content: ownSources
        ? `Research task started.\n\n${describeOwnSources(ownSources)}`
        : "Research task started",
      data: {
        ...(ownSources ? { ownSources } : {}),
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
            url: `/jobs?kind=research&external_id=${encodeURIComponent(runId)}`,
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
