import { MemoizedMarkdown } from "@ngriffin_uk/polychat-component-content";
import { FileText } from "lucide-react";

interface RetrievedDocument {
  id: string;
  type?: string;
  title?: string;
  score?: number;
  content: string;
}

interface DocumentSearchData {
  query?: string;
  documents?: RetrievedDocument[];
}

const isDocument = (value: unknown): value is RetrievedDocument =>
  Boolean(value) &&
  typeof value === "object" &&
  typeof (value as RetrievedDocument).content === "string";

const readSearchData = (data: unknown): DocumentSearchData => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }

  const record = data as DocumentSearchData;

  return {
    query: typeof record.query === "string" ? record.query : undefined,
    documents: Array.isArray(record.documents) ? record.documents.filter(isDocument) : [],
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
        {documents.map((document) => (
          <li
            key={document.id}
            className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700"
          >
            <div className="mb-1 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <FileText size={13} aria-hidden="true" />
              <span className="truncate font-medium text-zinc-700 dark:text-zinc-200">
                {document.title || "Untitled"}
              </span>
              {document.type && <span>{document.type}</span>}
              {typeof document.score === "number" && (
                <span className="tabular-nums">{Math.round(document.score * 100)}% match</span>
              )}
            </div>
            <MemoizedMarkdown className="max-w-none text-sm">{document.content}</MemoizedMarkdown>
          </li>
        ))}
      </ul>
    </div>
  );
}
