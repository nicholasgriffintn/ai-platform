import { Button, Checkbox, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import type { NotebookActions } from "@ngriffin_uk/polychat-library-react";
import type { NotebookResearchDepth, NotebookResearchResult } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage, toggleSetMember } from "@ngriffin_uk/polychat-utility-core";
import { Globe, LoaderCircle, Send, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const DEPTH_OPTIONS = [
  { value: "fast", label: "Fast research" },
  { value: "deep", label: "Deep research" },
] as const;

export function NotebookResearchBox({ actions }: { actions: NotebookActions }) {
  const [query, setQuery] = useState("");
  const [depth, setDepth] = useState<NotebookResearchDepth>("fast");
  const [results, setResults] = useState<NotebookResearchResult[] | null>(null);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set());

  const search = async () => {
    const trimmed = query.trim();

    if (!trimmed) {
      return;
    }

    try {
      const response = await actions.research.mutateAsync({ query: trimmed, depth });

      if (response.depth === "fast") {
        setResults(response.results);
        setChosen(new Set(response.results.map((result) => result.url)));
      } else {
        setQuery("");
        toast.success(
          "Deep research is under way. The report lands in your sources when it is done.",
        );
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "The search did not come back"));
    }
  };

  const importChosen = async () => {
    const picked = (results ?? []).filter((result) => chosen.has(result.url));

    try {
      await actions.addSources.mutateAsync({
        results: picked.map(({ title, url }) => ({ title, url })),
      });
      setResults(null);
      setQuery("");
      toast.success(picked.length === 1 ? "Page added" : `${picked.length} pages added`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Those pages could not be added"));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex flex-col rounded-xl border border-border bg-surface-elevated shadow-sm transition-colors focus-within:border-ring"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <textarea
          value={query}
          rows={2}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void search();
            }
          }}
          placeholder="Search the web for new sources"
          aria-label="Search the web for new sources"
          className="min-w-0 resize-none bg-transparent px-3 pt-3 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <div className="flex min-w-0 items-center gap-1.5 pl-1 text-muted-foreground">
            <Globe className="size-4 shrink-0" aria-hidden="true" />
            <FormSelect
              options={DEPTH_OPTIONS}
              value={depth}
              onValueChange={setDepth}
              fullWidth={false}
              portal
              aria-label="Research depth"
              triggerClassName="h-8 min-h-8 w-fit gap-1 border-0 bg-transparent px-1.5 text-xs shadow-none hover:bg-selection dark:bg-transparent dark:hover:bg-selection"
            />
          </div>
          <Button
            type="submit"
            disabled={!query.trim() || actions.research.isPending}
            className="size-8 cursor-pointer rounded-md bg-human-action p-0 text-human-action-foreground shadow-sm transition-colors hover:bg-human-action/90 disabled:cursor-not-allowed disabled:opacity-50"
            title={depth === "deep" ? "Start deep research" : "Search the web"}
            aria-label={depth === "deep" ? "Start deep research" : "Search the web"}
          >
            {actions.research.isPending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </form>
      {actions.research.isPending ? (
        <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground" role="status">
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
          {depth === "deep" ? "Starting deep research…" : "Looking around the web…"}
        </p>
      ) : (
        <p className="px-1 text-xs text-muted-foreground">
          {depth === "deep"
            ? "Writes a full report in the background and adds the pages it cites."
            : "Finds pages you can pick from and add."}
        </p>
      )}
      {results ? (
        <div className="flex flex-col gap-2 rounded-xl border border-border p-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              {results.length === 0
                ? "Nothing worth bringing back."
                : `${results.length} pages found`}
            </p>
            <Button variant="icon" aria-label="Dismiss results" onClick={() => setResults(null)}>
              <X className="size-4" />
            </Button>
          </div>
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {results.map((result) => (
              <li key={result.url}>
                <label className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 hover:bg-selection">
                  <Checkbox
                    className="mt-0.5"
                    checked={chosen.has(result.url)}
                    onCheckedChange={() =>
                      setChosen((current) => toggleSetMember(current, result.url))
                    }
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-foreground">{result.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {new URL(result.url).hostname}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {results.length > 0 ? (
            <Button
              size="sm"
              variant="primary"
              disabled={chosen.size === 0}
              isLoading={actions.addSources.isPending}
              onClick={() => void importChosen()}
            >
              Add {chosen.size === 1 ? "1 page" : `${chosen.size} pages`}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
