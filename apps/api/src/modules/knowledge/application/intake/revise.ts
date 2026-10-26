import { KNOWLEDGE_BODY_METADATA_KEY, type SourceStatus } from "@ngriffin_uk/polychat-schemas";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  deleteKnowledgeBodies,
  prepareKnowledgeBody,
} from "~/modules/knowledge/application/intake/body";
import { readKnowledgeBody } from "~/modules/knowledge/domain/envelope";
import { KnowledgeDocumentRepository } from "~/modules/knowledge/infrastructure/KnowledgeDocumentRepository";
import type { SourceRecord } from "~/modules/sources/infrastructure/SourceRepository";

export async function reviseKnowledgeContent(
  context: Pick<ServiceContext, "env" | "repositories">,
  source: SourceRecord,
  revision: {
    content: string | null;
    title?: string;
    status?: SourceStatus;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const metadata = { ...(revision.metadata ?? parseJsonRecord(source.metadata)) };
  const prepared = await prepareKnowledgeBody(
    context.env,
    source.id,
    revision.content ?? "",
    readKnowledgeBody(metadata),
  );
  const documents = context.repositories.get(KnowledgeDocumentRepository);

  if (prepared.body) {
    metadata[KNOWLEDGE_BODY_METADATA_KEY] = prepared.body;
  } else {
    delete metadata[KNOWLEDGE_BODY_METADATA_KEY];
  }

  await documents.update(source.id, {
    title: revision.title ?? source.title,
    status: revision.status ?? source.status,
    metadata,
    content: revision.content === null ? null : prepared.content,
  });

  if (prepared.changed && prepared.content === source.content) {
    await documents.markBodyChanged(source.id);
  }

  if (prepared.staleKey) {
    await deleteKnowledgeBodies(context, [prepared.staleKey]);
  }
}
