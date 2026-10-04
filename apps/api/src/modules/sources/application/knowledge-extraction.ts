import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { readPrivateFile } from "~/infrastructure/storage/read-resource";
import { convertBlobToMarkdownViaCloudflare } from "~/modules/documents/application/convert";
import { SourceIndexRepository } from "~/modules/sources/infrastructure/SourceIndexRepository";

export async function extractKnowledgeSource(
  context: ServiceContext,
  sourceId: string,
): Promise<void> {
  const repository = new SourceIndexRepository(context.env);
  const source = await repository.getSnapshot(sourceId);

  if (
    !source ||
    source.content ||
    source.kind !== "file" ||
    !source.storage_key ||
    !source.mime_type
  ) {
    return;
  }

  if (
    source.mime_type.startsWith("image/") ||
    source.mime_type.startsWith("audio/") ||
    source.mime_type.startsWith("video/")
  ) {
    return;
  }

  if (source.byte_size !== null && source.byte_size > 25 * 1024 * 1024) {
    throw new AssistantError("Source file exceeds extraction limits", ErrorType.PARAMS_ERROR, 413);
  }

  const file = await readPrivateFile({
    context,
    kind: "source",
    resourceId: sourceId,
    userId: context.requireUser().id,
  });
  const bytes = await file.object.arrayBuffer();

  if (bytes.byteLength > 25 * 1024 * 1024) {
    throw new AssistantError("Source file exceeds extraction limits", ErrorType.PARAMS_ERROR, 413);
  }

  const content = source.mime_type.startsWith("text/")
    ? new TextDecoder().decode(bytes)
    : (
        await convertBlobToMarkdownViaCloudflare(
          context.env,
          new Blob([bytes], { type: source.mime_type }),
          source.filename ?? source.title,
        )
      ).result;

  if (!content?.trim() || new TextEncoder().encode(content).length > 256 * 1024) {
    throw new AssistantError(
      "Source has no indexable text within extraction limits",
      ErrorType.PARAMS_ERROR,
      422,
    );
  }

  await repository.storeExtraction(sourceId, source.knowledge_revision, content);
}
