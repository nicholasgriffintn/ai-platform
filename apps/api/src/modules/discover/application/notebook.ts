import {
  DISCOVER_NOTEBOOK_NAME,
  DISCOVER_RESEARCH_METADATA_KEY,
  DISCOVER_SIGNAL_METADATA_KEY,
} from "@ngriffin_uk/polychat-schemas";
import { readNonEmptyString, readStringArray } from "@ngriffin_uk/polychat-utility-core";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { discoverTopicKey } from "~/modules/discover/domain/edition";
import {
  readResearchResults,
  type DiscoverResearchResult,
} from "~/modules/discover/domain/research";
import { withKnowledgeText } from "~/modules/knowledge/application/intake/body";
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
  attemptedAt: string | null;
  error: string | null;
  lines: string[];
  items: DiscoverResearchResult[];
}

export interface DiscoverResearchDocument {
  sourceId: string;
  topic: string;
  readAt: string | null;
  attemptedAt: string | null;
  error: string | null;
  content: string;
}

export interface DiscoverDocuments {
  signals: DiscoverSignalDocument[];
  research: DiscoverResearchDocument[];
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
      "What Discover knows. Poly keeps this notebook: a document per connected service and a dated research document per followed topic. Each edition is written from these.",
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
        readAt: readNonEmptyString(metadata.readAt) ?? null,
        attemptedAt: readNonEmptyString(metadata.attemptedAt) ?? null,
        error: readNonEmptyString(metadata.error) ?? null,
        lines: readStringArray(metadata.lines),
        items: readResearchResults(metadata.items),
      });
    } else if (typeof topic === "string" && topic) {
      research.push({
        sourceId: source.id,
        topic,
        readAt: readNonEmptyString(metadata.readAt) ?? null,
        attemptedAt: readNonEmptyString(metadata.attemptedAt) ?? null,
        error: readNonEmptyString(metadata.error) ?? null,
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
    await withKnowledgeText(
      context,
      await context.repositories.get(SourceRepository).listCollectionSources(notebook.id),
    ),
  );
}
