import { excerptAround } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

const MAX_TERMS = 6;
const MIN_TERM_LENGTH = 2;
const EXCERPT_CHARS = 280;
const CANDIDATE_MULTIPLIER = 4;

export interface ConversationRecallMatch {
  conversationId: string;
  title: string;
  role: "user" | "assistant";
  date: string;
  excerpt: string;
}

export function recallSearchTerms(query: string): string[] {
  const terms = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length >= MIN_TERM_LENGTH);

  return [...new Set(terms)].slice(0, MAX_TERMS);
}

export async function searchPastConversations(
  context: ServiceContext,
  params: {
    query: string;
    projectId: string | null;
    excludeConversationId?: string;
    limit: number;
  },
): Promise<ConversationRecallMatch[]> {
  const user = context.requireUser();
  const terms = recallSearchTerms(params.query);

  if (terms.length === 0) {
    return [];
  }

  if (params.projectId) {
    await requireProjectAccess(context, params.projectId);
  }

  const rows = await context.repositories.messages.searchConversationExcerpts({
    userId: user.id,
    projectId: params.projectId,
    terms,
    excludeConversationId: params.excludeConversationId,
    limit: params.limit * CANDIDATE_MULTIPLIER,
  });
  const seen = new Set<string>();
  const matches: ConversationRecallMatch[] = [];

  for (const row of rows) {
    if (seen.has(row.conversation_id)) {
      continue;
    }

    seen.add(row.conversation_id);
    matches.push({
      conversationId: row.conversation_id,
      title: row.title?.trim() || "Untitled conversation",
      role: row.role,
      date: row.created_at.slice(0, 10),
      excerpt: excerptAround(row.content, terms, EXCERPT_CHARS),
    });

    if (matches.length >= params.limit) {
      break;
    }
  }

  return matches;
}
