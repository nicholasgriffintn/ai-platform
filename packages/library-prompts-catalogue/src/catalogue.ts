import { agentPromptEntries } from "./data/agents.js";
import { appPromptEntries } from "./data/apps.js";
import { assistantPromptEntries } from "./data/assistant.js";
import { chatPromptEntries } from "./data/chat.js";
import { functionPromptEntries } from "./data/functions.js";
import { providerPromptEntries } from "./data/providers.js";
import { sandboxPromptEntries } from "./data/sandbox.js";
import { teammatePromptEntries } from "./data/teammates.js";
import { validatePromptEntry, type PromptEntry, type PromptTask } from "./schema.js";

const allPromptEntries = [
  ...chatPromptEntries,
  ...assistantPromptEntries,
  ...appPromptEntries,
  ...providerPromptEntries,
  ...functionPromptEntries,
  ...agentPromptEntries,
  ...sandboxPromptEntries,
  ...teammatePromptEntries,
] as const;

export type PromptId = (typeof allPromptEntries)[number]["id"];

export const promptEntries: readonly PromptEntry[] = allPromptEntries;

const entriesById = new Map<string, PromptEntry>();
const entriesByTask = new Map<PromptTask, PromptEntry[]>();

for (const entry of promptEntries) {
  if (entriesById.has(entry.id)) {
    throw new Error(`Duplicate prompt id: ${entry.id}`);
  }

  entriesById.set(entry.id, entry);

  const bucket = entriesByTask.get(entry.task);

  if (bucket) {
    bucket.push(entry);
  } else {
    entriesByTask.set(entry.task, [entry]);
  }
}

export function getCataloguePromptEntry(id: string): PromptEntry | undefined {
  return entriesById.get(id);
}

export function hasCataloguePromptEntry(id: string): id is PromptId {
  return entriesById.has(id);
}

export function listCataloguePromptEntries(filter?: {
  task?: PromptTask;
  variant?: string;
}): readonly PromptEntry[] {
  const candidates = filter?.task ? (entriesByTask.get(filter.task) ?? []) : promptEntries;

  if (filter?.variant === undefined) {
    return candidates;
  }

  return candidates.filter((entry) => entry.variant === filter.variant);
}

export function getCataloguePromptEntriesByTask(task: PromptTask): readonly PromptEntry[] {
  return entriesByTask.get(task) ?? [];
}

export function getCataloguePromptEntryByTask(
  task: PromptTask,
  variant?: string,
): PromptEntry | undefined {
  const candidates = entriesByTask.get(task) ?? [];

  if (variant === undefined) {
    return candidates[0];
  }

  return candidates.find((entry) => entry.variant === variant);
}

export function validatePromptCatalogue(
  entries: readonly PromptEntry[] = promptEntries,
): readonly string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    if (seen.has(entry.id)) {
      problems.push(`${entry.id}: duplicate id`);
    }

    seen.add(entry.id);

    for (const problem of validatePromptEntry(entry)) {
      problems.push(`${entry.id}: ${problem}`);
    }
  }

  return problems;
}
