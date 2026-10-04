import { KnowledgePassagesView } from "@ngriffin_uk/polychat-component-content";
import { Button, Card, FormInput } from "@ngriffin_uk/polychat-component-ui";
import { useKnowledgeSearch } from "@ngriffin_uk/polychat-library-react";
import { useState } from "react";

export function KnowledgeSearchPanel({ projectId }: { projectId?: string }) {
  const [query, setQuery] = useState("");
  const search = useKnowledgeSearch(projectId);

  return (
    <Card className="mb-6 space-y-4 p-5 shadow-none">
      <form
        className="flex items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (query.trim()) {
            search.mutate({ query, projectId, topK: 5 });
          }
        }}
      >
        <FormInput
          aria-label="Search knowledge"
          placeholder="Search your knowledge sources…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button type="submit" disabled={search.isPending || !query.trim()}>
          {search.isPending ? "Searching…" : "Search"}
        </Button>
      </form>
      {search.error ? (
        <p role="alert" className="text-sm text-destructive">
          {search.error.message}
        </p>
      ) : null}
      {search.data ? (
        <div className="space-y-4">
          {!search.data.semanticSearchAvailable ? (
            <p className="text-xs text-muted-foreground">
              Showing keyword matches while semantic search is unavailable.
            </p>
          ) : null}
          <KnowledgePassagesView data={{ documents: search.data.documents }} />
        </div>
      ) : null}
    </Card>
  );
}
