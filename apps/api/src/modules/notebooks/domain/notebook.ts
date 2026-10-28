import {
  notebookGuideSchema,
  notebookSettingsSchema,
  type Notebook,
  type NotebookGuide,
  type NotebookSettings,
  type SourceSummary,
} from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { NotebookRecord } from "~/modules/notebooks/infrastructure/NotebookRepository";

const NOTEBOOK_CONTEXT_SHARE = 3;
const CHARACTERS_PER_TOKEN = 4;
const DEFAULT_CONTEXT_WINDOW = 8000;

export type NotebookSourceRole = "source" | "note" | "media";

export function readNotebookSettings(value: string | null): NotebookSettings {
  return notebookSettingsSchema
    .catch(notebookSettingsSchema.parse({}))
    .parse(safeParseJson(value ?? "{}") ?? {});
}

export function readNotebookGuide(value: string | null): NotebookGuide | null {
  const parsed = notebookGuideSchema.safeParse(value ? safeParseJson(value) : null);

  return parsed.success ? parsed.data : null;
}

export function formatNotebook(record: NotebookRecord, canManage: boolean): Notebook {
  return {
    id: record.id,
    name: record.title,
    scope: record.project_id
      ? { kind: "project", projectId: record.project_id }
      : { kind: "personal" },
    instructions: record.instructions ?? "",
    settings: readNotebookSettings(record.settings),
    guide: readNotebookGuide(record.guide),
    canManage,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function notebookSourceRole(source: Pick<SourceSummary, "metadata">): NotebookSourceRole {
  if (source.metadata.note === true) {
    return "note";
  }

  if (typeof source.metadata.generation === "object" && source.metadata.generation !== null) {
    return "media";
  }

  return "source";
}

export function isGuideCurrent(guide: NotebookGuide | null, sourceIds: readonly string[]): boolean {
  if (!guide || guide.sourceIds.length !== sourceIds.length) {
    return false;
  }

  const summarised = new Set(guide.sourceIds);

  return sourceIds.every((sourceId) => summarised.has(sourceId));
}

export function shouldSearchNotebookSources(
  sources: readonly { content: string | null }[],
  contextWindow: number | undefined,
): boolean {
  const budget = Math.floor(
    ((contextWindow ?? DEFAULT_CONTEXT_WINDOW) * CHARACTERS_PER_TOKEN) / NOTEBOOK_CONTEXT_SHARE,
  );

  return sources.reduce((sum, source) => sum + (source.content?.length ?? 0), 0) > budget;
}
