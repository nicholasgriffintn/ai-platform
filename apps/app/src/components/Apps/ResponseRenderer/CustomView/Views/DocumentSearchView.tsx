import { MemoizedMarkdown } from "@ngriffin_uk/polychat-component-content";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { FileText } from "lucide-react";

interface RetrievedDocument {
  id: string;
  chunkId?: string;
  type?: string;
  title?: string;
  score?: number;
  rankingMethod?: "provider-score" | "reciprocal-rank-fusion";
  content: string;
}

interface DocumentSearchData {
  query?: string;
  documents?: RetrievedDocument[];
}

const readDocument = (value: unknown): RetrievedDocument | null => {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.content !== "string") {
    return null;
  }

  return {
    id: value.id,
    content: value.content,
    chunkId: typeof value.chunkId === "string" ? value.chunkId : undefined,
    type: typeof value.type === "string" ? value.type : undefined,
    title: typeof value.title === "string" ? value.title : undefined,
    score:
      typeof value.score === "number" && Number.isFinite(value.score) ? value.score : undefined,
    rankingMethod:
      value.rankingMethod === "provider-score" || value.rankingMethod === "reciprocal-rank-fusion"
        ? value.rankingMethod
        : undefined,
  };
};

const readSearchData = (data: unknown): DocumentSearchData => {
  if (!isRecord(data)) {
    return {};
  }

  return {
    query: typeof data.query === "string" ? data.query : undefined,
    documents: Array.isArray(data.documents)
      ? data.documents.map(readDocument).filter((document) => document !== null)
      : [],
  };
};

export function DocumentSearchView({ data }: { data: unknown }) {
  const { query, documents = [] } = readSearchData(data);

  if (documents.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {query
          ? `No passages matched “${query}” in your documents.`
          : "No matching passages were found."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {documents.length} {documents.length === 1 ? "passage" : "passages"}
        {query ? ` for “${query}”` : ""}
      </p>
      <ul className="space-y-2">
        {documents.map((document, index) => (
          <li
            key={document.chunkId ?? `${document.id}:${index}`}
            className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700"
          >
            <div className="mb-1 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <FileText size={13} aria-hidden="true" />
              <span className="truncate font-medium text-zinc-700 dark:text-zinc-200">
                {document.title || "Untitled"}
              </span>
              {document.type && <span>{document.type}</span>}
              {typeof document.score === "number" &&
                document.rankingMethod !== "reciprocal-rank-fusion" && (
                  <span className="tabular-nums">{Math.round(document.score * 100)}% match</span>
                )}
              {document.rankingMethod === "reciprocal-rank-fusion" && <span>combined ranking</span>}
            </div>
            <MemoizedMarkdown className="max-w-none text-sm">{document.content}</MemoizedMarkdown>
          </li>
        ))}
      </ul>
    </div>
  );
}
