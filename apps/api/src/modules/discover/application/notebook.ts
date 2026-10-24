import {
  DISCOVER_NOTEBOOK_NAME,
  DISCOVER_RESEARCH_METADATA_KEY,
  DISCOVER_SIGNAL_METADATA_KEY,
} from "@ngriffin_uk/polychat-schemas";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { discoverTopicKey } from "~/modules/discover/domain/edition";
import { createNotebook, updateNotebook } from "~/modules/notebooks/application/notebooks";
import { readNotebookSettings } from "~/modules/notebooks/domain/notebook";
import {
  NotebookRepository,
  type NotebookRecord,
} from "~/modules/notebooks/infrastructure/NotebookRepository";
import {
  SourceRepository,
  type SourceRecord,
} from "~/modules/sources/infrastructure/SourceRepository";

export interface DiscoverSignalDocument {
  sourceId: string;
  signalId: string;
  providerId: string;
  title: string;
  readAt: string | null;
  error: string | null;
  lines: string[];
}

export interface DiscoverResearchDocument {
  sourceId: string;
  topic: string;
  readAt: string | null;
  content: string;
}

export interface DiscoverDocuments {
  signals: DiscoverSignalDocument[];
  research: DiscoverResearchDocument[];
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

export async function findDiscoverNotebook(
  context: ServiceContext,
  userId: number,
): Promise<NotebookRecord | null> {
  const notebooks = await context.repositories
    .get(NotebookRepository)
    .listPersonalNotebooks(userId);

  return notebooks.find((notebook) => readNotebookSettings(notebook.settings).discover) ?? null;
}

export async function ensureDiscoverNotebook(context: ServiceContext): Promise<NotebookRecord> {
  const user = context.requireUser();
  const existing = await findDiscoverNotebook(context, user.id);

  if (existing) {
    return existing;
  }

  const notebooks = await context.repositories
    .get(NotebookRepository)
    .listPersonalNotebooks(user.id);
  const sameName = notebooks.find(
    (notebook) => discoverTopicKey(notebook.title) === discoverTopicKey(DISCOVER_NOTEBOOK_NAME),
  );
  const notebookId =
    sameName?.id ??
    (await createNotebook(context, { name: DISCOVER_NOTEBOOK_NAME, scope: { kind: "personal" } }))
      .id;

  await updateNotebook(context, notebookId, {
    instructions:
      "What Discover knows. Poly keeps this notebook: a document per connected service and a dated research document per followed topic. The morning edition is written from these.",
    settings: { discover: true },
  });

  const notebook = await context.repositories.get(NotebookRepository).getNotebook(notebookId);

  if (!notebook) {
    throw new Error("The Discover notebook could not be read back");
  }

  return notebook;
}

export function readDiscoverDocuments(sources: readonly SourceRecord[]): DiscoverDocuments {
  const signals: DiscoverSignalDocument[] = [];
  const research: DiscoverResearchDocument[] = [];

  for (const source of sources) {
    const metadata = parseJsonRecord(source.metadata);
    const signal = metadata[DISCOVER_SIGNAL_METADATA_KEY];
    const topic = metadata[DISCOVER_RESEARCH_METADATA_KEY];

    if (typeof signal === "string" && signal) {
      signals.push({
        sourceId: source.id,
        signalId: signal,
        providerId: source.provider ?? "",
        title: source.title,
        readAt: stringOrNull(metadata.readAt),
        error: stringOrNull(metadata.error),
        lines: Array.isArray(metadata.lines)
          ? metadata.lines.filter((line): line is string => typeof line === "string")
          : [],
      });
    } else if (typeof topic === "string" && topic) {
      research.push({
        sourceId: source.id,
        topic,
        readAt: stringOrNull(metadata.readAt),
        content: source.content ?? "",
      });
    }
  }

  return { signals, research };
}

export async function listDiscoverDocuments(
  context: ServiceContext,
  userId: number,
): Promise<DiscoverDocuments> {
  const notebook = await findDiscoverNotebook(context, userId);

  if (!notebook) {
    return { signals: [], research: [] };
  }

  return readDiscoverDocuments(
    await context.repositories.get(SourceRepository).listCollectionSources(notebook.id),
  );
}
