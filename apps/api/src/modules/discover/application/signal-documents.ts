import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { commitKnowledgeDocument } from "~/modules/sources/application/knowledge/documents";
import { requireKnowledgeTarget } from "~/modules/sources/application/knowledge/targets";
import type { KnowledgeDocument, KnowledgeTarget } from "~/modules/sources/domain/knowledge/item";

import { ensureDiscoverResearchFolder } from "./folders";

export async function discoverSignalSourceId(userId: number, signalId: string): Promise<string> {
  return `discover_signal_${(await sha256Hex(`${userId}:${signalId}`)).slice(0, 24)}`;
}

export async function discoverKnowledgeTarget(
  context: ServiceContext,
  notebookId: string,
): Promise<KnowledgeTarget> {
  const target = await requireKnowledgeTarget(
    context,
    { projectId: null, notebookId },
    { manage: true },
  );

  return {
    ...target,
    collectionIds: [...target.collectionIds, await ensureDiscoverResearchFolder(context)],
  };
}

export async function writeDiscoverDocument(
  context: ServiceContext,
  notebookId: string,
  document: KnowledgeDocument,
): Promise<void> {
  await commitKnowledgeDocument(
    context,
    await discoverKnowledgeTarget(context, notebookId),
    document,
  );
}
