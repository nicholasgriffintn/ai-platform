import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { createSource, updateSource } from "~/modules/sources/application/sources";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";

export interface DiscoverDocumentInput {
  id: string;
  kind: "connector" | "text";
  title: string;
  provider: string | null;
  content: string | undefined;
  metadata: Record<string, unknown>;
}

export async function discoverSignalSourceId(userId: number, signalId: string): Promise<string> {
  return `discover_signal_${(await sha256Hex(`${userId}:${signalId}`)).slice(0, 24)}`;
}

export async function writeDiscoverDocument(
  context: ServiceContext,
  notebookId: string,
  input: DiscoverDocumentInput,
): Promise<void> {
  const user = context.requireUser();
  const sources = context.repositories.get(SourceRepository);
  const existing = await sources.getSource(input.id);

  if (existing && existing.created_by_user_id === user.id) {
    await updateSource(context, user.id, input.id, {
      title: input.title,
      status: "available",
      metadata: input.metadata,
      ...(input.content === undefined ? {} : { content: input.content }),
    });
  } else {
    await createSource(
      context,
      user.id,
      {
        projectId: null,
        kind: input.kind,
        title: input.title,
        status: "available",
        content: input.content ?? "",
        provider: input.provider,
        metadata: input.metadata,
      },
      { id: input.id },
    );
  }

  await sources.addCollectionSources(notebookId, [input.id]);
}
