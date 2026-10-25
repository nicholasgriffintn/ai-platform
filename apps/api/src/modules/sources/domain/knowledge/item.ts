import { comparableHttpUrl } from "@ngriffin_uk/polychat-utility-core";

export interface KnowledgeTarget {
  userId: number;
  projectId: string | null;
  collectionIds: readonly string[];
}

export interface KnowledgeDocument {
  id: string;
  kind: "connector" | "text" | "url";
  title: string;
  provider: string | null;
  externalUri?: string;
  content: string | undefined;
  metadata: Record<string, unknown>;
}

export interface KnowledgeArticleCandidate {
  title: string;
  url: string;
  snippet: string;
  source?: string;
  date?: string;
}

export function knowledgeArticleKey(url: string): string | null {
  const comparable = comparableHttpUrl(url);

  return comparable ? `url:${comparable}` : null;
}

export function knowledgeScopeKey(target: Pick<KnowledgeTarget, "userId" | "projectId">): string {
  return target.projectId ? `project:${target.projectId}` : `personal:${target.userId}`;
}

export function dedupeArticleCandidates<TCandidate extends KnowledgeArticleCandidate>(
  candidates: readonly TCandidate[],
): TCandidate[] {
  const seen = new Set<string>();
  const kept: TCandidate[] = [];

  for (const candidate of candidates) {
    const key = knowledgeArticleKey(candidate.url);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    kept.push(candidate);
  }

  return kept;
}
