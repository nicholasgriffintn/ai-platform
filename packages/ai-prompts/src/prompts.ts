import {
  getCataloguePromptEntriesByTask,
  getCataloguePromptEntry,
  getCataloguePromptEntryByTask,
  listCataloguePromptEntries,
  type PromptEntry,
  type PromptId,
  type PromptTask,
} from "@ngriffin_uk/polychat-library-prompts-catalogue";

import { PromptNotFoundError } from "./errors.js";
import { renderPromptText, type PromptValues } from "./render.js";

export function getPrompt(id: PromptId): PromptEntry {
  const entry = getCataloguePromptEntry(id);

  if (!entry) {
    throw new PromptNotFoundError(id);
  }

  return entry;
}

export function tryGetPrompt(id: string): PromptEntry | undefined {
  return getCataloguePromptEntry(id);
}

export function getPromptText(id: PromptId): string {
  return getPrompt(id).text;
}

export function renderPrompt(id: PromptId, values: PromptValues = {}): string {
  const entry = getPrompt(id);
  const defaults = Object.fromEntries(
    (entry.variables ?? [])
      .filter((variable) => variable.default !== undefined)
      .map((variable) => [variable.name, variable.default as string]),
  );

  return renderPromptText(entry.text, values, defaults);
}

export function getPromptForTask(task: PromptTask, variant?: string): PromptEntry {
  const entry = getCataloguePromptEntryByTask(task, variant);

  if (!entry) {
    throw new PromptNotFoundError(variant ? `${task} (${variant})` : task);
  }

  return entry;
}

export function getPromptsForTask(task: PromptTask): readonly PromptEntry[] {
  return getCataloguePromptEntriesByTask(task);
}

export function renderPromptForTask(
  task: PromptTask,
  values: PromptValues = {},
  variant?: string,
): string {
  const entry = getPromptForTask(task, variant);

  return renderPrompt(entry.id as PromptId, values);
}

export function listPrompts(filter?: {
  task?: PromptTask;
  variant?: string;
}): readonly PromptEntry[] {
  return listCataloguePromptEntries(filter);
}
