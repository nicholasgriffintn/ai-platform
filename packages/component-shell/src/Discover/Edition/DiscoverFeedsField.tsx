import { Button, Textarea } from "@ngriffin_uk/polychat-component-ui";
import { DISCOVER_FEED_LIMIT, discoverFeedUrlSchema } from "@ngriffin_uk/polychat-schemas";
import { splitNonEmptyLines } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

export interface DiscoverFeedsFieldProps {
  feeds: readonly string[];
  isSaving: boolean;
  onSave: (feeds: string[]) => void;
}

function describeProblem(lines: readonly string[]): string | null {
  if (lines.length > DISCOVER_FEED_LIMIT) {
    return `Follow up to ${DISCOVER_FEED_LIMIT} feeds.`;
  }

  const invalid = lines.find((line) => !discoverFeedUrlSchema.safeParse(line).success);

  return invalid ? `${invalid} is not a feed address.` : null;
}

export function DiscoverFeedsField({ feeds, isSaving, onSave }: DiscoverFeedsFieldProps) {
  const [draft, setDraft] = useState(feeds.join("\n"));
  const lines = splitNonEmptyLines(draft);
  const problem = describeProblem(lines);
  const changed = lines.join("\n") !== feeds.join("\n");

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();

        if (!problem) {
          onSave(lines);
        }
      }}
    >
      <div className="flex flex-col gap-0.5">
        <label htmlFor="discover-feeds" className="text-sm font-medium text-foreground">
          Your feeds
        </label>
        <p className="text-xs text-muted-foreground">
          One RSS or Atom address per line: blogs, newsletters, or the private RSS link Patreon
          gives you for each creator you support.
        </p>
      </div>
      <Textarea
        id="discover-feeds"
        value={draft}
        rows={3}
        placeholder="https://www.patreon.com/rss/creator?auth=…"
        aria-invalid={problem ? true : undefined}
        onChange={(event) => setDraft(event.target.value)}
      />
      {problem && <p className="text-xs text-destructive">{problem}</p>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!changed || Boolean(problem) || isSaving}>
          Save feeds
        </Button>
      </div>
    </form>
  );
}
