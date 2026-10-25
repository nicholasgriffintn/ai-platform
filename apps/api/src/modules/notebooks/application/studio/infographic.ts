import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  notebookInfographicOrientationSchema,
  type NotebookStudioRequest,
  type SourceGeneration,
  type SourceSummary,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { drawImage } from "~/modules/generate/application/stored-image";
import { INFOGRAPHIC_SIZES } from "~/modules/notebooks/domain/studio-guidance";
import {
  failSourceGeneration,
  finaliseSourceGeneration,
} from "~/modules/sources/application/generation/finalise";
import { buildSourceMaterial } from "~/modules/sources/application/material";
import {
  readSourceRecordGeneration,
  updateSourceRecord,
} from "~/modules/sources/application/media/metadata";
import { createSource, toSourceSummary } from "~/modules/sources/application/sources";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";

import { requireNotebookAccess, type NotebookAccess } from "../access";
import { enqueueNotebookJob } from "../jobs";
import { resolveNotebookSources } from "../notebooks";
import { writeInfographicPrompt } from "./drafts";

const logger = getLogger({ prefix: "notebooks/infographic" });

const infographicInputSchema = z.object({
  orientation: notebookInfographicOrientationSchema.catch("landscape"),
  language: z.string().catch("en"),
  focus: z.string().optional().catch(undefined),
});

export async function startInfographic(
  context: ServiceContext,
  access: NotebookAccess,
  request: Extract<NotebookStudioRequest, { kind: "infographic" }>,
  sourceIds: string[],
): Promise<SourceSummary> {
  const infographic = await createSource(context, context.requireUser().id, {
    projectId: access.notebook.project_id,
    kind: "file",
    title: "Infographic",
    status: "processing",
    metadata: {
      generation: {
        type: "studio",
        mode: "image",
        sourceIds,
        input: {
          orientation: request.orientation,
          language: request.language,
          focus: request.focus,
        },
      } satisfies SourceGeneration,
    },
  });

  await context.repositories
    .get(SourceRepository)
    .addCollectionSources(access.notebook.id, [infographic.id]);
  await enqueueNotebookJob(context, access.notebook.project_id, {
    job: "infographic",
    notebookId: access.notebook.id,
    sourceId: infographic.id,
  });

  return toSourceSummary(infographic);
}

export async function runInfographic(
  context: ServiceContext,
  job: { notebookId: string; sourceId: string },
): Promise<void> {
  const infographic = await context.repositories.get(SourceRepository).getSource(job.sourceId);
  const generation = infographic ? readSourceRecordGeneration(infographic) : null;

  if (!infographic || infographic.status !== "processing" || !generation) {
    return;
  }

  try {
    const access = await requireNotebookAccess(context, job.notebookId);
    const input = infographicInputSchema.parse(generation.input ?? {});
    const sources = await resolveNotebookSources(context, access, generation.sourceIds);
    const brief = await writeInfographicPrompt(context, {
      language: input.language,
      focus: input.focus,
      orientation: input.orientation,
      material: buildSourceMaterial(sources),
    });
    const image = await drawImage(context, {
      completionId: `${infographic.id}-infographic`,
      prompt: brief.prompt,
      ...INFOGRAPHIC_SIZES[input.orientation],
    });
    const titled = await updateSourceRecord(context, infographic, {
      title: brief.title,
      generation: { prompt: brief.prompt },
    });

    await finaliseSourceGeneration(context, titled, { response: image });
  } catch (error) {
    logger.error("Notebook infographic failed", { sourceId: job.sourceId, error });
    await failSourceGeneration(
      context,
      infographic,
      getErrorMessage(error, "The infographic could not be drawn"),
    );
  }
}
