import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { createSource } from "~/modules/sources/application/sources";
import {
  knowledgeScopeKey,
  type KnowledgeDocument,
  type KnowledgeTarget,
} from "~/modules/sources/domain/knowledge/item";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";

export async function knowledgeSourceId(
  target: Pick<KnowledgeTarget, "userId" | "projectId">,
  key: string,
): Promise<string> {
  return `kb_${(await sha256Hex(`${knowledgeScopeKey(target)}:${key}`)).slice(0, 40)}`;
}

export async function commitKnowledgeDocument(
  context: ServiceContext,
  target: KnowledgeTarget,
  document: KnowledgeDocument,
): Promise<string> {
  const sources = context.repositories.get(SourceRepository);
  const existing = await sources.getSource(document.id);

  if (existing) {
    const metadata = parseJsonRecord(existing.metadata);

    if (
      existing.project_id !== target.projectId ||
      (!target.projectId && existing.created_by_user_id !== target.userId) ||
      existing.kind === "memory" ||
      metadata.immutableSnapshot === true
    ) {
      throw new AssistantError(
        "This knowledge document belongs to another scope",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    await sources.updateSource(document.id, {
      title: document.title,
      status: "available",
      metadata: { ...metadata, ...document.metadata },
      ...(document.content === undefined ? {} : { content: document.content }),
    });
  } else {
    await createSource(
      context,
      target.userId,
      {
        projectId: target.projectId,
        kind: document.kind,
        title: document.title,
        status: "available",
        content: document.content ?? "",
        provider: document.provider,
        ...(document.externalUri ? { externalUri: document.externalUri } : {}),
        metadata: document.metadata,
      },
      { id: document.id },
    );
  }

  for (const collectionId of target.collectionIds) {
    await sources.addCollectionSources(collectionId, [document.id]);
  }

  return document.id;
}
