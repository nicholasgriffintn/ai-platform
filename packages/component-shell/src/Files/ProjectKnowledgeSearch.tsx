import { Button, FormInput } from "@ngriffin_uk/polychat-component-ui";
import { useProjectKnowledgeSearch } from "@ngriffin_uk/polychat-library-react";
import { isHttpUrl } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

export function ProjectKnowledgeSearch({ projectId }: { projectId?: string }) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const search = useProjectKnowledgeSearch(projectId, query);

  return (
    <div className="mb-6 space-y-3">
      <form
        className="flex items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const nextQuery = draft.trim();

          if (!nextQuery) {
            return;
          }

          setQuery(nextQuery);
          if (nextQuery === query) {
            void search.refetch();
          }
        }}
      >
        <FormInput
          label={projectId ? "Search project knowledge" : "Search your knowledge"}
          value={draft}
          maxLength={1000}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Find a decision, runbook or reference"
        />
        <Button type="submit" disabled={!draft.trim()} isLoading={search.isFetching}>
          Search
        </Button>
      </form>
      {query && search.isSuccess && !search.data.semanticSearchAvailable ? (
        <p className="text-sm text-muted-foreground">
          Showing keyword matches. Semantic search is unavailable.
        </p>
      ) : null}
      {search.error ? (
        <p role="alert" className="text-sm text-failure">
          {search.error.message}
        </p>
      ) : null}
      {query && search.isSuccess && search.data.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No matching passages. New sources become searchable after indexing completes.
        </p>
      ) : null}
      {search.data?.data.map((passage) => (
        <article key={passage.chunkId} className="rounded-lg border p-4">
          <h3 className="text-sm font-medium">{passage.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Revision {passage.provenance.sourceRevision}
          </p>
          {passage.provenance.upstreamRevision ? (
            <p className="text-xs text-muted-foreground">
              Upstream revision {passage.provenance.upstreamRevision}
            </p>
          ) : null}
          {passage.provenance.lastSyncedAt ? (
            <p className="text-xs text-muted-foreground">
              Synced {passage.provenance.lastSyncedAt}
            </p>
          ) : null}
          <p className="mt-2 text-sm whitespace-pre-wrap">{passage.content}</p>
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
        </article>
      ))}
    </div>
  );
}
