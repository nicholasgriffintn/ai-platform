import { Link } from "@ngriffin_uk/polychat-component-ui";
import { getFilesPath, useProjectKnowledgeSearch } from "@ngriffin_uk/polychat-library-react";
import { isHttpUrl } from "@ngriffin_uk/polychat-utility-core";

export function KnowledgePassages({
  basePath,
  projectId,
  query,
}: {
  basePath: string;
  projectId: string;
  query: string;
}) {
  const search = useProjectKnowledgeSearch(projectId, query);

  if (!query) {
    return null;
  }

  return (
    <section aria-label="Passages inside files" className="space-y-3">
      <h2 className="text-sm text-muted-foreground">
        {search.isFetching ? "Reading inside files…" : `Inside files for “${query}”`}
      </h2>
      {search.error ? (
        <p role="alert" className="text-sm text-failure">
          {search.error.message}
        </p>
      ) : null}
      {search.isSuccess && search.data.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No matching passages. New sources become searchable once indexing finishes.
        </p>
      ) : null}
      <ul className="grid gap-3 md:grid-cols-2">
        {search.data?.data.map((passage) => (
          <li key={passage.chunkId} className="rounded-xl border border-border bg-surface p-4">
            <Link
              href={getFilesPath(basePath, "sources", encodeURIComponent(passage.sourceId))}
              className="text-sm font-medium"
            >
              {passage.title}
            </Link>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Revision {passage.provenance.sourceRevision}
              {passage.provenance.upstreamRevision
                ? ` · upstream ${passage.provenance.upstreamRevision}`
                : ""}
              {passage.provenance.lastSyncedAt
                ? ` · synced ${passage.provenance.lastSyncedAt}`
                : ""}
            </p>
            <p className="mt-2 line-clamp-6 text-sm whitespace-pre-wrap">{passage.content}</p>
            {passage.provenance.externalUri && isHttpUrl(passage.provenance.externalUri) ? (
              <a
                className="mt-2 inline-block text-sm underline"
                href={passage.provenance.externalUri}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open original
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
