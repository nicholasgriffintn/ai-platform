import type { FolderStudioRequest, NotebookStudioResponse } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { withKnowledgeText } from "~/modules/knowledge/application/intake/body";
import { createOutput, toOutputSummary } from "~/modules/outputs/application";
import { createOutputProvenance } from "~/modules/outputs/application/provenance";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import { buildSourceMaterial } from "~/modules/sources/application/material";
import { requireCollectionAccess } from "~/modules/sources/application/sources";
import {
  SourceRepository,
  type SourceRecord,
} from "~/modules/sources/infrastructure/SourceRepository";

import { enqueueNotebookJob } from "../jobs";
import { STUDIO_OUTPUT_SHAPES } from "./drafts";
import { runStudioOutput } from "./run";

async function resolveFolderSources(
  context: ServiceContext,
  folderId: string,
  requestedIds?: readonly string[],
): Promise<SourceRecord[]> {
  const files = await context.repositories.get(SourceRepository).listCollectionSources(folderId);
  const requested = requestedIds ? new Set(requestedIds) : null;

  return withKnowledgeText(
    context,
    files.filter((file) => file.status === "available" && (!requested || requested.has(file.id))),
  );
}

export async function startFolderStudio(
  context: ServiceContext,
  folderId: string,
  request: FolderStudioRequest,
): Promise<NotebookStudioResponse> {
  const user = context.requireUser();
  const folder = await requireCollectionAccess(context, user.id, folderId, true);
  const sources = await resolveFolderSources(context, folder.id, request.sourceIds);

  if (!buildSourceMaterial(sources)) {
    throw new AssistantError(
      "Add a file with some text to this folder before making a report from it",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const shape = STUDIO_OUTPUT_SHAPES[request.kind];
  const sourceIds = sources.map((source) => source.id);
  const output = await createOutput(
    context,
    user.id,
    {
      projectId: folder.project_id,
      capabilityId: shape.capabilityId,
      kind: shape.outputKind,
      title: shape.pendingTitle,
      status: "pending",
      content: { request: { ...request, sourceIds } },
    },
    { provenance: createOutputProvenance({ origin: "user", completeness: "partial" }) },
  );
  const outputs = context.repositories.get(OutputRepository);

  await outputs.attachSources(output.id, sourceIds);
  await outputs.linkOutputs(folder.id, [output.id]);
  await enqueueNotebookJob(context, folder.project_id, {
    job: "folder_studio",
    folderId: folder.id,
    outputId: output.id,
  });

  return { type: "output", output: toOutputSummary(output) };
}

export function runFolderStudio(
  context: ServiceContext,
  job: { folderId: string; outputId: string },
): Promise<"ready" | "failed" | "skipped"> {
  return runStudioOutput(context, job.outputId, async (request) => {
    await requireCollectionAccess(context, context.requireUser().id, job.folderId);

    return resolveFolderSources(context, job.folderId, request.sourceIds);
  });
}
