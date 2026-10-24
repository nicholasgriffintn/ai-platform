import { Button, ConfirmationDialog, FormInput } from "@ngriffin_uk/polychat-component-ui";
import { usePodcastFeed } from "@ngriffin_uk/polychat-library-react";
import type { SourceCollection } from "@ngriffin_uk/polychat-schemas";
import { Copy, Rss } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function PodcastFeedControls({ show }: { show: SourceCollection }) {
  const feed = usePodcastFeed();
  const [url, setUrl] = useState<string | null>(null);
  const [confirmingTurnOff, setConfirmingTurnOff] = useState(false);

  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium">RSS feed</h2>
          <p className="text-xs text-muted-foreground">
            {show.hasFeed
              ? "On. Podcast apps following the link get new episodes."
              : "Off. Make a private link to listen in any podcast app."}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Rss size={14} />}
          isLoading={feed.enable.isPending}
          onClick={() => void feed.enable.mutateAsync(show.id).then((result) => setUrl(result.url))}
        >
          {show.hasFeed ? "Get a new feed link" : "Get feed link"}
        </Button>
        {show.hasFeed ? (
          <Button variant="outline" size="sm" onClick={() => setConfirmingTurnOff(true)}>
            Turn off feed
          </Button>
        ) : null}
      </div>
      {url ? (
        <div className="space-y-1 rounded-lg border border-border bg-selection p-3">
          <div className="flex items-end gap-2">
            <FormInput
              label="Feed link"
              value={url}
              readOnly
              onFocus={(event) => event.target.select()}
            />
            <Button
              variant="secondary"
              icon={<Copy size={14} />}
              onClick={() => {
                void navigator.clipboard.writeText(url);
                toast.success("Feed link copied");
              }}
            >
              Copy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Paste it into your podcast app's "follow a show by URL" option. Copy it now: it is only
            shown once, and anyone with it can listen.
          </p>
        </div>
      ) : null}
      <ConfirmationDialog
        open={confirmingTurnOff}
        onOpenChange={setConfirmingTurnOff}
        title="Turn off feed"
        description="Podcast apps following this show stop getting episodes. You can make a new link later."
        confirmText="Turn off feed"
        variant="destructive"
        isLoading={feed.disable.isPending}
        onConfirm={async () => {
          await feed.disable.mutateAsync(show.id);
          setUrl(null);
          setConfirmingTurnOff(false);
        }}
      />
    </section>
  );
}
