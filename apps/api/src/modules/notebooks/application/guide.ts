import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import { notebookGuideDraftSchema, type NotebookGuide } from "@ngriffin_uk/polychat-schemas";

import { ai } from "~/infrastructure/ai";
import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { getTierModel } from "~/modules/models/application/resolve";
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

  const user = context.requireUser();
  const { model, provider, effort } = await getTierModel(context.env, user, NOTEBOOK_MODEL_TIER);
  const { object } = await ai.generateObject({
    env: context.env,
    user,
    model,
    provider,
    reasoning_effort: effort,
    disable_functions: true,
    name: "notebook_guide",
    schema: notebookGuideDraftSchema,
    system: renderPrompt("notebooks/guide", { notebookName: access.notebook.title }),
    prompt: material,
  });
  const guide: NotebookGuide = {
    ...object,
    sourceIds,
    generatedAt: new Date().toISOString(),
  };

  await context.repositories.get(NotebookRepository).setGuide(notebookId, guide);

  return guide;
}
