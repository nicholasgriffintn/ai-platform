import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import { HighlightedSearchExcerpt } from "./HighlightedSearchExcerpt.js";

interface ConversationSearchMatch {
  conversationId: string;
  title: string;
  date: string;
  role: string;
  excerpt: string;
}

function isConversationSearchMatch(value: unknown): value is ConversationSearchMatch {
  return (
    isRecord(value) &&
    typeof value.conversationId === "string" &&
    typeof value.title === "string" &&
    typeof value.date === "string" &&
    typeof value.role === "string" &&
    typeof value.excerpt === "string"
  );
}

function readMatches(data: unknown): { query: string; matches: ConversationSearchMatch[] } {
  if (!isRecord(data)) {
    return { query: "", matches: [] };
  }

  const matches = Array.isArray(data.matches) ? data.matches.filter(isConversationSearchMatch) : [];

  return {
    query: typeof data.query === "string" ? data.query : "",
    matches,
  };
}

export function ConversationSearchView({ data }: { data: unknown }) {
  const { query, matches } = readMatches(data);
  const terms = query.match(/[\p{L}\p{N}]+/gu) ?? [];

  if (matches.length === 0) {
    return <p className="text-sm text-muted-foreground">No matching conversations.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="min-w-full divide-y divide-border text-left">
        <thead className="bg-surface-elevated">
          <tr>
            <th scope="col" className="px-3 py-2 text-xs font-medium text-muted-foreground">
              Conversation
            </th>
            <th scope="col" className="px-3 py-2 text-xs font-medium text-muted-foreground">
              Date
            </th>
            <th scope="col" className="px-3 py-2 text-xs font-medium text-muted-foreground">
              Matching excerpt
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {matches.map((match, index) => (
            <tr key={`${match.conversationId}-${match.date}-${index}`}>
              <td className="px-3 py-2 align-top text-sm font-medium text-foreground">
                {match.title}
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {match.role === "user" ? "You said" : "Poly said"}
                </span>
              </td>
              <td className="px-3 py-2 align-top text-sm whitespace-nowrap text-muted-foreground">
                {match.date}
              </td>
              <td className="max-w-[36rem] px-3 py-2 align-top text-sm text-muted-foreground">
                <HighlightedSearchExcerpt excerpt={match.excerpt} terms={terms} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
