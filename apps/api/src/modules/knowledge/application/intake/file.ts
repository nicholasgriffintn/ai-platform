import type { Source } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { buildPrivateFileUrl } from "~/infrastructure/storage/resource-urls";
import { commitKnowledgeDocument } from "~/modules/knowledge/application/intake/commit";
import { requireKnowledgeTarget } from "~/modules/knowledge/application/intake/targets";
import type { KnowledgeDocument } from "~/modules/knowledge/domain/item";
import { formatSource } from "~/modules/sources/application/sources";

export type FileKnowledgeSourceInput = Omit<KnowledgeDocument, "id" | "metadata"> & {
  id?: string;
  projectId?: string | null;
  notebookId?: string | null;
  collectionIds?: readonly string[];
  metadata?: Record<string, unknown>;
};

export interface StoreKnowledgeFileInput extends Omit<FileKnowledgeSourceInput, "file"> {
  key: string;
  data: string | ArrayBuffer | Uint8Array;
  mimeType: string;
  filename?: string | null;
  byteSize?: number | null;
}

export async function fileKnowledgeSource(
  context: ServiceContext,
  input: FileKnowledgeSourceInput,
): Promise<Source> {
  const { projectId, notebookId, collectionIds, ...document } = input;
  const target = await requireKnowledgeTarget(
    context,
    { projectId: projectId ?? null, notebookId: notebookId ?? null },
    { manage: false },
  );

  return formatSource(
    await commitKnowledgeDocument(
      context,
      { ...target, collectionIds: [...target.collectionIds, ...(collectionIds ?? [])] },
      { ...document, id: document.id ?? generateId(), metadata: document.metadata ?? {} },
    ),
  );
}

export async function storeKnowledgeFile(
  context: ServiceContext,
  input: StoreKnowledgeFileInput,
): Promise<{ source: Source; url: string }> {
  const { key, data, mimeType, filename, byteSize, ...document } = input;

  await StorageService.forPrivateAssets(context).uploadObject(key, data, {
    httpMetadata: { contentType: mimeType },
  });

  const source = await fileKnowledgeSource(context, {
    ...document,
    file: { key, mimeType, filename: filename ?? null, byteSize: byteSize ?? null },
  });

  return { source, url: buildPrivateFileUrl(context.env, "source", source.id) };
}
