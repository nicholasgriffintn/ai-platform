import { SourceList } from "@ngriffin_uk/polychat-component-account";
import { Button, Card, ConfirmationDialog, FormInput } from "@ngriffin_uk/polychat-component-ui";
import {
  usePodcastFeed,
  useSourceCollections,
  useSourceMutations,
  useSources,
} from "@ngriffin_uk/polychat-library-react";
import type { SourceCollection } from "@ngriffin_uk/polychat-schemas";
import { Copy, Plus, Radio, Rss } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { NewEpisodeDialog } from "./NewEpisodeDialog.js";

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function ShowRow({ show }: { show: SourceCollection }) {
  const feed = usePodcastFeed();
  const [url, setUrl] = useState<string | null>(null);
  const [confirmingTurnOff, setConfirmingTurnOff] = useState(false);
  const episodes = `${show.sourceCount} ${show.sourceCount === 1 ? "episode" : "episodes"}`;

  return (
    <li className="space-y-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{show.title}</p>
          <p className="text-xs text-muted-foreground">
            {episodes} · {show.hasFeed ? "RSS feed on" : "No RSS feed"}
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
          <Button variant="ghost" size="sm" onClick={() => setConfirmingTurnOff(true)}>
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
    </li>
  );
}

function ShowsSection({ projectId, shows }: { projectId?: string; shows: SourceCollection[] }) {
  const mutations = useSourceMutations();
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");

  const createShow = async () => {
    await mutations.createCollection.mutateAsync({
      projectId,
      title: title.trim(),
      kind: "podcast",
    });
    setTitle("");
    setIsAdding(false);
  };

  return (
    <Card className="gap-4 p-6 shadow-none">
      <SectionHeader
        title="Shows and RSS feeds"
        description="Put episodes in a show to listen in any podcast app. Each show gets its own private feed link."
        action={
          isAdding ? null : (
            <Button variant="secondary" icon={<Plus size={16} />} onClick={() => setIsAdding(true)}>
              New show
            </Button>
          )
        }
      />
      {isAdding ? (
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void createShow();
          }}
        >
          <FormInput
            label="Show name"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Morning briefing"
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!title.trim()}
            isLoading={mutations.createCollection.isPending}
          >
            Create
          </Button>
          <Button type="button" variant="ghost" onClick={() => setIsAdding(false)}>
            Cancel
          </Button>
        </form>
      ) : null}
      {shows.length > 0 ? (
        <ul className="divide-y divide-border">
          {shows.map((show) => (
            <ShowRow key={show.id} show={show} />
          ))}
        </ul>
      ) : isAdding ? null : (
        <p className="text-sm text-muted-foreground">
          No shows yet. Episodes still work without one; a show is only needed for a feed.
        </p>
      )}
    </Card>
  );
}

export function PodcastStudio({ basePath, projectId }: { basePath: string; projectId?: string }) {
  const { data: collections } = useSourceCollections(projectId);
  const { data: episodes, isLoading, error } = useSources({ projectId, kind: "podcast" });
  const mutations = useSourceMutations();
  const [isCreating, setIsCreating] = useState(false);
  const [episodeToDelete, setEpisodeToDelete] = useState<string | null>(null);
  const shows = collections?.filter((collection) => collection.kind === "podcast") ?? [];
  const newEpisode = (
    <Button variant="primary" icon={<Plus size={16} />} onClick={() => setIsCreating(true)}>
      New episode
    </Button>
  );

  return (
    <div className="space-y-6">
      <Card className="gap-4 p-6 shadow-none">
        <SectionHeader
          title="Episodes"
          description="Two AI hosts talk through your sources: documents, links and transcribed recordings."
          action={episodes?.length ? newEpisode : null}
        />
        {!isLoading && !error && !episodes?.length ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-10 text-center">
            <Radio size={28} className="text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="font-medium text-foreground">No episodes yet</p>
              <p className="text-sm text-muted-foreground">
                Choose a few sources and a style, and you get an episode with a transcript and show
                notes.
              </p>
            </div>
            {newEpisode}
          </div>
        ) : (
          <SourceList
            sources={episodes}
            isLoading={isLoading}
            errorMessage={error?.message}
            itemHref={(source) => `${basePath}/${encodeURIComponent(source.id)}`}
            onDelete={setEpisodeToDelete}
          />
        )}
      </Card>

      <ShowsSection projectId={projectId} shows={shows} />

      <NewEpisodeDialog
        open={isCreating}
        onOpenChange={setIsCreating}
        projectId={projectId}
        shows={shows}
      />
      <ConfirmationDialog
        open={episodeToDelete !== null}
        onOpenChange={(open) => !open && setEpisodeToDelete(null)}
        title="Delete episode"
        description="Delete this episode? It also leaves its show's feed."
        confirmText="Delete episode"
        variant="destructive"
        isLoading={mutations.deleteSource.isPending}
        onConfirm={async () => {
          if (episodeToDelete) {
            await mutations.deleteSource.mutateAsync(episodeToDelete);
          }

          setEpisodeToDelete(null);
        }}
      />
    </div>
  );
}
