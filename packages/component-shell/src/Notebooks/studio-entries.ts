import type { NotebookDetail, OutputSummary, SourceSummary } from "@ngriffin_uk/polychat-schemas";

export type StudioEntry =
  | { type: "output"; at: string; output: OutputSummary }
  | { type: "source"; at: string; source: SourceSummary; isNote: boolean };

export function studioEntries(notebook: NotebookDetail): StudioEntry[] {
  return [
    ...notebook.outputs.map((output) => ({
      type: "output" as const,
      at: output.createdAt,
      output,
    })),
    ...notebook.media.map((source) => ({
      type: "source" as const,
      at: source.createdAt,
      source,
      isNote: false,
    })),
    ...notebook.notes.map((source) => ({
      type: "source" as const,
      at: source.createdAt,
      source,
      isNote: true,
    })),
  ].sort((left, right) => right.at.localeCompare(left.at));
}

export interface OpenStudioItem {
  origin: "output" | "source";
  id: string;
  title: string;
}
