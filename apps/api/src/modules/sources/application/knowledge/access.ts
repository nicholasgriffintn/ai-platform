import { authorise } from "@ngriffin_uk/polychat-library-policy";
import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { SourceRecord } from "~/modules/sources/infrastructure/SourceRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import {
  createGitHubKnowledgeReader,
  createPublicGitHubKnowledgeReader,
  type GitHubKnowledgeReader,
} from "./github-reader";

export async function canReadKnowledgeSource(
  context: ServiceContext,
  userId: number,
  sourceId: string,
  readers = new Map<string, Promise<GitHubKnowledgeReader>>(),
  expectedBlobSha?: string,
) {
  const document = await context.repositories.knowledgeSyncs.document(sourceId);

  if (!document || (expectedBlobSha !== undefined && document.blob_sha !== expectedBlobSha)) {
    return false;
  }

  const sync = await context.repositories.knowledgeSyncs.get(document.sync_id);

  if (!sync || !["idle", "syncing"].includes(sync.status)) {
    return false;
  }

  let role = "";

  if (sync.project_id) {
    role = (await requireProjectAccess(context, sync.project_id)).role;
  }

  if (
    !authorise("resource.read", {
      actorId: String(userId),
      ownerId: String(sync.created_by_user_id),
      scope: sync.project_id ? "project" : "personal",
      member: Boolean(sync.project_id),
      role,
    }).allowed
  ) {
    return false;
  }

  const key = `${userId}:${sync.repository}:${sync.created_by_user_id === userId ? sync.installation_id : "reader"}`;

  try {
    let readerPromise = readers.get(key);

    if (readerPromise === undefined) {
      readerPromise = sync.project_id
        ? createPublicGitHubKnowledgeReader(sync.repository)
        : createGitHubKnowledgeReader(
            context,
            userId,
            sync.repository,
            sync.created_by_user_id === userId ? sync.installation_id : undefined,
          );
      readers.set(key, readerPromise);
    }

    const reader = await readerPromise;
    const current = await reader.file(document.path, sync.branch);

    await reader.assertCurrentAccess();
    const currentSync = await context.repositories.knowledgeSyncs.get(sync.id);

    if (sync.project_id) {
      await requireProjectAccess(context, sync.project_id);
    }

    return (
      current.sha === document.blob_sha &&
      currentSync?.revision === sync.revision &&
      ["idle", "syncing"].includes(currentSync.status)
    );
  } catch {
    return false;
  }
}

export async function filterReadableKnowledgeSources<
  T extends { id: string; provider: string | null; metadata: string },
>(context: ServiceContext, userId: number, sources: T[]): Promise<T[]> {
  const readers = new Map<string, Promise<GitHubKnowledgeReader>>();
  const allowed = await mapWithConcurrency(sources, 4, (source) =>
    source.provider !== "github-knowledge"
      ? Promise.resolve(true)
      : canReadKnowledgeSource(
          context,
          userId,
          source.id,
          readers,
          safeParseJson<{ blobSha: string }>(source.metadata)?.blobSha ?? "",
        ),
  );

  return sources.filter((_source, index) => allowed[index]);
}

export async function requireKnowledgeSourceAccess(
  context: ServiceContext,
  userId: number,
  source: SourceRecord,
  mutate: boolean,
) {
  if (source.provider !== "github-knowledge") {
    return;
  }

  if (mutate) {
    throw new AssistantError(
      "Change the repository or disconnect its sync to update imported content",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (
    !(await canReadKnowledgeSource(
      context,
      userId,
      source.id,
      undefined,
      safeParseJson<{ blobSha: string }>(source.metadata)?.blobSha ?? "",
    ))
  ) {
    throw new AssistantError(
      "Source is unavailable or repository access changed",
      ErrorType.NOT_FOUND,
      404,
    );
  }
}
