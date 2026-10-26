import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  notebookStudioRequestSchema,
  videoOverviewOutputContentSchema,
  type NotebookStudioRequest,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import { buildSourceMaterial, type MaterialSource } from "~/modules/sources/application/material";

import { requireNotebookAccess } from "../access";
import { resolveNotebookSources } from "../notebooks";
import { writeStudioDraft, type OutputStudioRequest, type StudioDraft } from "./drafts";
import { produceVideoOverview } from "./video";

const logger = getLogger({ prefix: "notebooks/studio" });

function isOutputRequest(request: NotebookStudioRequest): request is OutputStudioRequest {
  return request.kind !== "audio" && request.kind !== "infographic";
}

async function finishDraft(
  context: ServiceContext,
  outputId: string,
  request: OutputStudioRequest,
  draft: StudioDraft,
): Promise<StudioDraft> {
  if (request.kind !== "video") {
    return draft;
  }

  return {
    title: draft.title,
    content: await produceVideoOverview(
      context,
      outputId,
      videoOverviewOutputContentSchema.parse(draft.content),
      request.language,
    ),
  };
}

export async function runNotebookStudio(
  context: ServiceContext,
  job: { notebookId: string; outputId: string },
): Promise<"ready" | "failed" | "skipped"> {
  return runStudioOutput(context, job.outputId, async (request) => {
    const access = await requireNotebookAccess(context, job.notebookId);

    return resolveNotebookSources(context, access, request.sourceIds);
  });
}

export async function runStudioOutput(
  context: ServiceContext,
  outputId: string,
  loadSources: (request: OutputStudioRequest) => Promise<MaterialSource[]>,
): Promise<"ready" | "failed" | "skipped"> {
  const user = context.requireUser();
  const repository = context.repositories.get(OutputRepository);
  const pending = await repository.getOutput(outputId);
  const parsed = notebookStudioRequestSchema.safeParse(
    pending ? parseJsonRecord(pending.content).request : undefined,
  );

  if (
    !pending ||
    pending.status !== "pending" ||
    !parsed.success ||
    !isOutputRequest(parsed.data)
  ) {
    return "skipped";
  }

  const request = parsed.data;

  try {
    const sources = await loadSources(request);
    const draft = await finishDraft(
      context,
      outputId,
      request,
      await writeStudioDraft(context, request, buildSourceMaterial(sources)),
    );

    await repository.updateOutput(outputId, {
      title: draft.title,
      status: "ready",
      content: draft.content,
      expectedRevision: pending.revision,
      updatedByUserId: user.id,
    });

    return "ready";
  } catch (error) {
    logger.error("Studio output failed", { outputId, error });

    const current = await repository.getOutput(outputId);

    if (current) {
      await repository.updateOutput(outputId, {
        status: "failed",
        content: { request, error: getErrorMessage(error, "This could not be made") },
        expectedRevision: current.revision,
        updatedByUserId: user.id,
      });
    }

    return "failed";
  }
}
