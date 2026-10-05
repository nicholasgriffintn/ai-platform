import type { KnowledgeSearch } from "@ngriffin_uk/polychat-schemas";
import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { canReadKnowledgeSource } from "./access";
import type { GitHubKnowledgeReader } from "./github-reader";

export async function searchKnowledge(context: ServiceContext, input: KnowledgeSearch) {
  const user = context.requireUser();

  if (input.projectId) {
    await requireProjectAccess(context, input.projectId);
  }

  const candidates = await context.repositories.repositoryKnowledgeSyncs.search(
    user.id,
    input.projectId,
    input.query,
  );
  const readers = new Map<string, Promise<GitHubKnowledgeReader>>();
  const allowed = await mapWithConcurrency(candidates, 4, (candidate) =>
    canReadKnowledgeSource(context, user.id, candidate.source_id, readers, candidate.blob_sha),
  );
  const results = [];

  for (const [index, candidate] of candidates.entries()) {
    if (!allowed[index]) {
      continue;
    }

    const match = candidate.content.toLowerCase().indexOf(input.query.toLowerCase());
    const start = Math.max(0, match - 300);

    results.push({
      sourceId: candidate.source_id,
      title: candidate.title,
      excerpt: candidate.content.slice(start, start + 4000),
      citation: candidate.external_uri,
      syncedAt: candidate.synced_at,
      commit: candidate.commit_sha,
    });

    if (results.length === input.limit) {
      break;
    }
  }

  return { results };
}
