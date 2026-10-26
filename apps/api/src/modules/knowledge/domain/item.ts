import type {
  KnowledgeOrigin,
  KnowledgeUpstream,
  SourceFile,
  SourceKind,
  SourceStatus,
} from "@ngriffin_uk/polychat-schemas";
import { comparableHttpUrl } from "@ngriffin_uk/polychat-utility-core";

export interface KnowledgeTarget {
  userId: number;
  projectId: string | null;
  collectionIds: readonly string[];
}

export type KnowledgeSourceKind = Exclude<SourceKind, "memory">;

export interface KnowledgeDocument {
  id: string;
  origin: KnowledgeOrigin;
  kind: KnowledgeSourceKind;
  title: string;
  provider: string | null;
  externalUri?: string | null;
  content: string | undefined;
  metadata: Record<string, unknown>;
  status?: SourceStatus;
  conversationId?: string | null;
  connectionId?: string | null;
  vectorId?: string | null;
  file?: SourceFile | null;
  upstream?: KnowledgeUpstream;
  immutable?: boolean;
  expiresAt?: string | null;
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
