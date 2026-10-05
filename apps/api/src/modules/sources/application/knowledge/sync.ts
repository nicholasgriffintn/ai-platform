import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryKnowledgeSyncRecord } from "~/modules/sources/infrastructure/RepositoryKnowledgeSyncRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import {
  isKnowledgeDocument,
  knowledgeCheckpointSchema,
  type KnowledgeCheckpoint,
} from "./checkpoint";
import {
  createGitHubKnowledgeReader,
  GitHubKnowledgeAccessError,
  UnsupportedKnowledgeFileError,
  type GitHubKnowledgeReader,
} from "./github-reader";

const MAX_VISITED_NODES = 10_000;
const MAX_NODES_PER_DELIVERY = 10;

async function advanceTree(
  reader: GitHubKnowledgeReader,
  record: RepositoryKnowledgeSyncRecord,
  checkpoint: KnowledgeCheckpoint,
) {
  const node = checkpoint.queue[0];
  const tree = await reader.tree(node.sha);
  const remaining = checkpoint.queue.slice(1);

  for (const entry of tree.tree) {
    const path = node.path ? `${node.path}/${entry.path}` : entry.path;
    const insidePath = !record.path || path === record.path || path.startsWith(record.path + "/");
    const leadsToPath = record.path.startsWith(path + "/");

    if (entry.type === "tree" && (insidePath || leadsToPath)) {
      remaining.push({ path, sha: entry.sha, type: "tree" });
    } else if (
      entry.type === "blob" &&
      entry.mode === "100644" &&
      insidePath &&
      isKnowledgeDocument(path) &&
      entry.size !== undefined &&
      entry.size <= 250_000
    ) {
      remaining.push({ path, sha: entry.sha, type: "blob" });
    }
  }

  if (checkpoint.visited + 1 + remaining.length > MAX_VISITED_NODES) {
    throw new AssistantError(
      "Select a smaller documentation directory for this sync",
      ErrorType.PARAMS_ERROR,
      422,
    );
  }

  return knowledgeCheckpointSchema.parse({
    ...checkpoint,
    visited: checkpoint.visited + 1,
    queue: remaining,
  });
}

async function advanceDocument(
  context: ServiceContext,
  reader: GitHubKnowledgeReader,
  record: RepositoryKnowledgeSyncRecord,
  checkpoint: KnowledgeCheckpoint,
) {
  const node = checkpoint.queue[0];
  const next = { ...checkpoint, visited: checkpoint.visited + 1, queue: checkpoint.queue.slice(1) };
  let file: Awaited<ReturnType<GitHubKnowledgeReader["file"]>>;

  try {
    file = await reader.file(node.path, checkpoint.commit);
  } catch (error) {
    if (!(error instanceof UnsupportedKnowledgeFileError)) {
      throw error;
    }

    await reader.assertCurrentAccess();
    await context.repositories.repositoryKnowledgeSyncs.saveCheckpoint(
      record,
      JSON.stringify(next),
    );

    return next;
  }

  if (file.sha !== node.sha) {
    throw new AssistantError(
      "Repository content changed during the import",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  await reader.assertCurrentAccess();
  await context.repositories.repositoryKnowledgeSyncs.saveDocument(record, {
    path: node.path,
    sha: file.sha,
    commit: checkpoint.commit,
    runId: checkpoint.runId,
    content: file.content,
    checkpoint: JSON.stringify(next),
  });

  return next;
}

export async function runKnowledgeSync(context: ServiceContext, syncId: string) {
  const user = context.requireUser();
  const repository = context.repositories.repositoryKnowledgeSyncs;
  const record = await repository.claim(syncId, user.id, generateId());

  if (!record) {
    return;
  }

  try {
    if (record.project_id) {
      await requireProjectAccess(context, record.project_id, ["owner", "admin"]);
    }

    const reader = await createGitHubKnowledgeReader(
      context,
      user.id,
      record.repository,
      record.installation_id,
    );

    if (record.project_id) {
      await reader.assertPublic();
    }

    let checkpoint: KnowledgeCheckpoint;

    if (record.checkpoint) {
      checkpoint = knowledgeCheckpointSchema.parse(safeParseJson(record.checkpoint));
    } else {
      const commit = await reader.commit(record.branch);

      checkpoint = {
        runId: generateId(),
        commit: commit.sha,
        visited: 0,
        queue: [{ path: "", type: "tree", sha: commit.commit.tree.sha }],
      };
      await repository.saveCheckpoint(record, JSON.stringify(checkpoint));
    }

    const deadline = Date.now() + 35_000;

    for (
      let processed = 0;
      processed < MAX_NODES_PER_DELIVERY && checkpoint.queue.length > 0 && Date.now() < deadline;
      processed++
    ) {
      if (checkpoint.queue[0].type === "tree") {
        checkpoint = await advanceTree(reader, record, checkpoint);
        await reader.assertCurrentAccess();
        await repository.saveCheckpoint(record, JSON.stringify(checkpoint));
      } else {
        checkpoint = await advanceDocument(context, reader, record, checkpoint);
      }
    }

    if (checkpoint.queue.length === 0) {
      await reader.assertCurrentAccess();
      await repository.finish(record, checkpoint.runId, checkpoint.commit);
    } else {
      await repository.release(record, "syncing");
    }
  } catch (error) {
    const denied =
      error instanceof GitHubKnowledgeAccessError ||
      (error instanceof AssistantError && [400, 403, 404, 422].includes(error.statusCode));

    await repository.release(
      record,
      denied ? "blocked" : "failed",
      denied
        ? "Repository access changed or the selected folder is unsupported. Reconnect and resume."
        : "Sync was interrupted. Progress is saved and will be retried.",
    );
  }
}
