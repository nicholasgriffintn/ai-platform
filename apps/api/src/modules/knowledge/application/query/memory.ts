import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { searchProjectKnowledge } from "~/modules/knowledge/application/query/search";

export interface MemoryPassage {
  documentId: string;
  title: string;
  content: string;
  score: number;
}

export async function searchMemoryKnowledge(
  context: ServiceContext,
  scope: { projectId: string | null; documentIds?: readonly string[] },
  query: string,
  topK: number,
): Promise<MemoryPassage[]> {
  const response = await searchProjectKnowledge(context, {
    query,
    top_k: topK,
    resourceTypes: ["memory"],
    ...(scope.projectId ? { projectId: scope.projectId } : {}),
    ...(scope.documentIds ? { sourceIds: [...scope.documentIds] } : { kinds: ["memory"] }),
  });

  return response.data.map((result) => ({
    documentId: result.sourceId,
    title: result.title,
    content: result.content,
    score: result.score,
  }));
}
