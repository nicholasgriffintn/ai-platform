import { SourceList } from "@ngriffin_uk/polychat-component-account";
import {
  Button,
  Card,
  ConfirmationDialog,
  FormCheckbox,
  FormInput,
  FormSelect,
  Textarea,
} from "@ngriffin_uk/polychat-component-ui";
import {
  useGeneratePodcast,
  usePodcastFeed,
  useSourceCollections,
  useSourceMutations,
  useSources,
} from "@ngriffin_uk/polychat-library-react";
import {
  getSourceMediaType,
  isTranscribableMediaType,
  PODCAST_FORMATS,
  podcastFormatSchema,
  podcastLengthSchema,
  readSourceMedia,
  type PodcastFormat,
  type PodcastLength,
  type SourceCollection,
  type SourceSummary,
} from "@ngriffin_uk/polychat-schemas";
import { Copy, Rss } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const LENGTH_OPTIONS: Array<{ value: PodcastLength; label: string }> = [
  { value: "short", label: "Short, about 5 minutes" },
  { value: "default", label: "Standard, about 10 minutes" },
  { value: "long", label: "Long, about 20 minutes" },
];

function isEpisodeMaterial(source: SourceSummary): boolean {
  if (source.status !== "available" || source.kind === "memory") {
    return false;
  }

  if (!isTranscribableMediaType(getSourceMediaType(source.file?.mimeType))) {
    return true;
  }

  return readSourceMedia(source.metadata).transcript?.status === "ready";
}

const FORMAT_OPTIONS = podcastFormatSchema.options.map((format) => ({
  value: format,
  label: PODCAST_FORMATS[format].label,
}));

function ShowFeed({ show }: { show: SourceCollection }) {
  const feed = usePodcastFeed();
  const [url, setUrl] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{show.title}</p>
        <p className="text-xs text-muted-foreground">
          {show.sourceCount} episodes · {show.hasFeed ? "Feed on" : "Feed off"}
        </p>
        {url ? (
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground" title={url}>
            {url}
          </p>
        ) : null}
      </div>
      {url ? (
        <Button
          variant="secondary"
          size="sm"
          icon={<Copy size={14} />}
          onClick={() => {
            void navigator.clipboard.writeText(url);
            toast.success("Feed link copied");
          }}
        >
          Copy
        </Button>
      ) : null}
      <Button
        variant="secondary"
        size="sm"
        icon={<Rss size={14} />}
        isLoading={feed.enable.isPending}
        onClick={() => void feed.enable.mutateAsync(show.id).then((result) => setUrl(result.url))}
      >
        {show.hasFeed ? "New feed link" : "Create feed link"}
      </Button>
      {show.hasFeed ? (
        <Button
          variant="ghost"
          size="sm"
          isLoading={feed.disable.isPending}
          onClick={() => void feed.disable.mutateAsync(show.id).then(() => setUrl(null))}
        >
          Turn off
        </Button>
      ) : null}
    </div>
  );
}

function PodcastShows({ projectId }: { projectId?: string }) {
  const { data: collections } = useSourceCollections(projectId);
  const mutations = useSourceMutations();
  const [title, setTitle] = useState("");
  const shows = collections?.filter((collection) => collection.kind === "podcast") ?? [];

  return (
    <Card className="gap-3 p-5 shadow-none">
      <div>
        <h3 className="text-base font-semibold text-foreground">Shows</h3>
        <p className="text-sm text-muted-foreground">
          A show collects episodes and gives them a private RSS feed for your podcast app. Anyone
          with the link can listen, so treat it like a password and make a new one to cut off old
          links.
        </p>
      </div>
      {shows.map((show) => (
        <ShowFeed key={show.id} show={show} />
      ))}
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void mutations.createCollection
            .mutateAsync({ projectId, title: title.trim(), kind: "podcast" })
            .then(() => setTitle(""));
        }}
      >
        <FormInput
          label="New show"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Morning briefing"
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={!title.trim()}
          isLoading={mutations.createCollection.isPending}
        >
          Add show
        </Button>
      </form>
    </Card>
  );
}

function EpisodeForm({ projectId, shows }: { projectId?: string; shows: SourceCollection[] }) {
  const { data: sources } = useSources({ projectId });
  const generate = useGeneratePodcast();
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [title, setTitle] = useState("");
  const [focus, setFocus] = useState("");
  const [format, setFormat] = useState<PodcastFormat>("deep_dive");
  const [length, setLength] = useState<PodcastLength>("default");
  const [showId, setShowId] = useState("");
  const candidates = sources?.filter(isEpisodeMaterial) ?? [];

  const startEpisode = async () => {
    await generate.mutateAsync({
      projectId,
      sourceIds: [...selected],
      title: title.trim() || undefined,
      focus: focus.trim() || undefined,
      format,
      length,
      showId: showId || undefined,
    });
    setSelected(new Set());
    setTitle("");
    setFocus("");
    toast.success("Episode started. It appears below in a few minutes.");
  };

  return (
    <Card className="gap-4 p-5 shadow-none">
      <div>
        <h3 className="text-base font-semibold text-foreground">New episode</h3>
        <p className="text-sm text-muted-foreground">
          Two hosts talk through the sources you pick. Audio and video sources need a transcript
          first.
        </p>
      </div>
      <fieldset className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border p-3">
        <legend className="px-1 text-sm font-medium">Sources</legend>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add sources to make an episode from.</p>
        ) : (
          candidates.map((source) => (
            <FormCheckbox
              key={source.id}
              label={source.title}
              labelPosition="right"
              checked={selected.has(source.id)}
              onCheckedChange={(checked) =>
                setSelected((current) => {
                  const next = new Set(current);

                  if (checked) {
                    next.add(source.id);
                  } else {
                    next.delete(source.id);
                  }

                  return next;
                })
              }
            />
          ))
        )}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormSelect
          label="Format"
          value={format}
          options={FORMAT_OPTIONS}
          onValueChange={(value) => setFormat(podcastFormatSchema.parse(value))}
        />
        <FormSelect
          label="Length"
          value={length}
          options={LENGTH_OPTIONS}
          onValueChange={(value) => setLength(podcastLengthSchema.parse(value))}
        />
        <FormSelect
          label="Show"
          value={showId}
          placeholder="No show"
          options={[
            { value: "", label: "No show" },
            ...shows.map((show) => ({ value: show.id, label: show.title })),
          ]}
          onValueChange={setShowId}
        />
      </div>
      <FormInput
        label="Title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Leave empty to let the hosts name it"
      />
      <div className="space-y-1">
        <label htmlFor="podcast-focus" className="text-sm font-medium">
          Focus
        </label>
        <Textarea
          id="podcast-focus"
          value={focus}
          onChange={(event) => setFocus(event.target.value)}
          placeholder="Who is listening and what the hosts should concentrate on"
          className="min-h-20"
        />
      </div>
      {generate.error ? (
        <p role="alert" className="text-sm text-failure">
          {generate.error.message}
        </p>
      ) : null}
      <div>
        <Button
          variant="primary"
          disabled={selected.size === 0}
          isLoading={generate.isPending}
          onClick={() => void startEpisode()}
        >
          Generate episode
        </Button>
      </div>
    </Card>
  );
}

export function PodcastStudio({ basePath, projectId }: { basePath: string; projectId?: string }) {
  const { data: collections } = useSourceCollections(projectId);
  const { data: episodes, isLoading, error } = useSources({ projectId, kind: "podcast" });
  const mutations = useSourceMutations();
  const [episodeToDelete, setEpisodeToDelete] = useState<string | null>(null);
  const shows = collections?.filter((collection) => collection.kind === "podcast") ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <EpisodeForm projectId={projectId} shows={shows} />
        <PodcastShows projectId={projectId} />
      </div>
      <Card className="p-6 shadow-none">
        <h3 className="mb-2 text-base font-semibold text-foreground">Episodes</h3>
        <SourceList
          sources={episodes}
          isLoading={isLoading}
          errorMessage={error?.message}
          itemHref={(source) => `${basePath}/${encodeURIComponent(source.id)}`}
          onDelete={setEpisodeToDelete}
        />
      </Card>
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
