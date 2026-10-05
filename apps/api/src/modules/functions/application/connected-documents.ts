import { knowledgeSearchSchema } from "@ngriffin_uk/polychat-schemas";

import { resolveServiceContext } from "~/infrastructure/context/serviceContext";
import { searchKnowledge } from "~/modules/sources/application/knowledge/search";
import type { IRequest } from "~/types";

import { resolveRequestProjectId } from "./request-context";

export async function queryConnectedDocuments(request: IRequest, query: string, limit: number) {
  const context = resolveServiceContext({
    context: request.context,
    env: request.env,
    user: request.user,
  });
  const input = knowledgeSearchSchema.parse({
    query,
    limit,
    projectId: resolveRequestProjectId(request) ?? undefined,
  });
  const response = await searchKnowledge(context, input);

  return response.results.map((result) => ({
    id: result.sourceId,
    title: result.title,
    content: result.excerpt,
    rankingMethod: "text-match",
    metadata: {
      type: "repository",
      sourceId: result.sourceId,
      citation: result.citation,
      commit: result.commit,
      syncedAt: result.syncedAt,
    },
  }));
}
