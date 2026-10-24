import type { NotebookStudioRequest, NotebookStudioResponse } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { createOutput, toOutputSummary } from "~/modules/outputs/application";
import { createOutputProvenance } from "~/modules/outputs/application/provenance";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import { buildSourceMaterial } from "~/modules/sources/application/material";
import { startPodcastGeneration } from "~/modules/sources/application/podcasts/generate";
import { toSourceSummary } from "~/modules/sources/application/sources";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";

import { requireNotebookAccess } from "../access";
import { enqueueNotebookJob } from "../jobs";
import { resolveNotebookSources } from "../notebooks";
import { STUDIO_OUTPUT_SHAPES } from "./drafts";
import { startInfographic } from "./infographic";

export async function startNotebookStudio(
  context: ServiceContext,
  notebookId: string,
  request: NotebookStudioRequest,
): Promise<NotebookStudioResponse> {
  const user = context.requireUser();
  const access = await requireNotebookAccess(context, notebookId);
  const sources = await resolveNotebookSources(context, access, request.sourceIds);
  const material = buildSourceMaterial(sources);

  if (!material) {
    throw new AssistantError(
      "Add a source with some text before making something from it",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  if (request.kind === "audio") {
    const episode = await startPodcastGeneration(context, {
      projectId: access.notebook.project_id,
      sourceIds: sources.map((source) => source.id),
      format: request.format,
      length: request.length,
      language: request.language,
      focus: request.focus,
    });

    await context.repositories.get(SourceRepository).addCollectionSources(notebookId, [episode.id]);

    return { type: "source", source: toSourceSummary(episode) };
  }

  if (request.kind === "infographic") {
    return {
      type: "source",
      source: await startInfographic(
        context,
        access,
        request,
        sources.map((source) => source.id),
      ),
    };
  }

  const shape = STUDIO_OUTPUT_SHAPES[request.kind];
  const output = await createOutput(
    context,
    user.id,
    {
      projectId: access.notebook.project_id,
      capabilityId: shape.capabilityId,
      kind: shape.outputKind,
      title: shape.pendingTitle,
      status: "pending",
      content: { request: { ...request, sourceIds: sources.map((source) => source.id) } },
    },
    {
      collectionId: notebookId,
      provenance: createOutputProvenance({ origin: "user", completeness: "partial" }),
    },
  );

  await context.repositories.get(OutputRepository).attachSources(
    output.id,
    sources.map((source) => source.id),
  );
  await enqueueNotebookJob(context, access.notebook.project_id, {
    job: "studio",
    notebookId,
    outputId: output.id,
  });

  return { type: "output", output: toOutputSummary(output) };
}
