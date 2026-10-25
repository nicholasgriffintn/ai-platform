import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import { notebookGuideDraftSchema, type NotebookGuide } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { generateTierObject } from "~/modules/models/application/tier-object";
import {
  isGuideCurrent,
  NOTEBOOK_MODEL_TIER,
  readNotebookGuide,
} from "~/modules/notebooks/domain/notebook";
import { NotebookRepository } from "~/modules/notebooks/infrastructure/NotebookRepository";
import { buildSourceMaterial } from "~/modules/sources/application/material";

import { requireNotebookAccess } from "./access";
import { resolveNotebookSources } from "./notebooks";

export async function writeNotebookGuide(
  context: ServiceContext,
  notebookId: string,
): Promise<NotebookGuide | null> {
  const access = await requireNotebookAccess(context, notebookId);
  const sources = await resolveNotebookSources(context, access);
  const sourceIds = sources.map((source) => source.id);
  const current = readNotebookGuide(access.notebook.guide);

  if (isGuideCurrent(current, sourceIds)) {
    return current;
  }

  const material = buildSourceMaterial(sources);

  if (!material) {
    return null;
  }

  const object = await generateTierObject(context, {
    tier: NOTEBOOK_MODEL_TIER,
    name: "notebook_guide",
    schema: notebookGuideDraftSchema,
    system: renderPrompt("notebooks/guide", { notebookName: access.notebook.title }),
    material,
  });
  const guide: NotebookGuide = {
    ...object,
    sourceIds,
    generatedAt: new Date().toISOString(),
  };

  await context.repositories.get(NotebookRepository).setGuide(notebookId, guide);

  return guide;
}
