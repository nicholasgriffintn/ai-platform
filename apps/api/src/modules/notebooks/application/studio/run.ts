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
import { buildSourceMaterial } from "~/modules/sources/application/material";

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
  const user = context.requireUser();
  const repository = context.repositories.get(OutputRepository);
  const pending = await repository.getOutput(job.outputId);
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
    const access = await requireNotebookAccess(context, job.notebookId);
    const sources = await resolveNotebookSources(context, access, request.sourceIds);
    const draft = await finishDraft(
      context,
      job.outputId,
      request,
      await writeStudioDraft(context, request, buildSourceMaterial(sources)),
    );

    await repository.updateOutput(job.outputId, {
      title: draft.title,
      status: "ready",
      content: draft.content,
      expectedRevision: pending.revision,
      updatedByUserId: user.id,
    });

    return "ready";
  } catch (error) {
    logger.error("Notebook studio output failed", { outputId: job.outputId, error });

    const current = await repository.getOutput(job.outputId);

    if (current) {
      await repository.updateOutput(job.outputId, {
        status: "failed",
        content: { request, error: getErrorMessage(error, "This could not be made") },
        expectedRevision: current.revision,
        updatedByUserId: user.id,
      });
    }

    return "failed";
  }
}
