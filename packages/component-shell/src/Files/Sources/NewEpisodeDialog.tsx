import {
  FormDialog,
  FormInput,
  FormRadioGroup,
  FormSelect,
  SearchInput,
  Textarea,
  cn,
} from "@ngriffin_uk/polychat-component-ui";
import { useGeneratePodcast, useSources } from "@ngriffin_uk/polychat-library-react";
import {
  getSourceMediaType,
  isTranscribableMediaType,
  PODCAST_FORMATS,
  podcastFormatSchema,
  readSourceMedia,
  type PodcastFormat,
  type PodcastLength,
  type SourceCollection,
  type SourceSummary,
} from "@ngriffin_uk/polychat-schemas";
import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const FORMAT_OPTIONS = podcastFormatSchema.options.map((format) => ({
  value: format,
  label: PODCAST_FORMATS[format].label,
  description: PODCAST_FORMATS[format].description,
}));

const LENGTH_OPTIONS: Array<{ value: PodcastLength; label: string; description: string }> = [
  { value: "short", label: "Short", description: "About 5 minutes" },
  { value: "default", label: "Standard", description: "About 10 minutes" },
  { value: "long", label: "Long", description: "About 20 minutes" },
];

const SELECTED_OPTION = "has-[:checked]:border-active-work has-[:checked]:bg-active-work/8";

/** Why a source cannot be talked about yet, or null when the hosts can use it. */
export function podcastSourceBlocker(source: SourceSummary): string | null {
  if (source.status !== "available") {
    return source.status === "processing" ? "Still processing" : "Not available";
  }

  const mediaType = getSourceMediaType(source.file?.mimeType);

  if (mediaType === "image") {
    return "Images have no text to discuss";
  }

  if (
    isTranscribableMediaType(mediaType) &&
    readSourceMedia(source.metadata).transcript?.status !== "ready"
  ) {
    return "Transcribe it first";
  }

  return null;
}

function SourcePicker({
  sources,
  selected,
  onToggle,
}: {
  sources: SourceSummary[];
  selected: ReadonlySet<string>;
  onToggle: (sourceId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const visible = sources.filter((source) =>
    source.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <fieldset className="space-y-2">
      <legend className="flex w-full items-baseline justify-between text-sm font-medium">
        <span>1. What should they talk about?</span>
        <span className="text-xs font-normal text-muted-foreground">{selected.size} selected</span>
      </legend>
      {sources.length > 6 ? (
        <SearchInput value={query} onChange={setQuery} placeholder="Find a source" />
      ) : null}
      <div className="max-h-60 divide-y divide-border overflow-y-auto rounded-lg border border-border">
        {sources.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Add documents, links or transcribed recordings to Files first.
          </p>
        ) : visible.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No sources match.</p>
        ) : (
          visible.map((source) => {
            const blocker = podcastSourceBlocker(source);

            return (
              <label
                key={source.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-selection",
                  blocker && "cursor-not-allowed opacity-60 hover:bg-transparent",
                )}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-active-work"
                  checked={selected.has(source.id)}
                  disabled={Boolean(blocker)}
                  onChange={() => onToggle(source.id)}
                />
                <span className="min-w-0 flex-1 truncate">{source.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground capitalize">
                  {blocker ?? getSourceMediaType(source.file?.mimeType) ?? source.kind}
                </span>
              </label>
            );
          })
        )}
      </div>
    </fieldset>
  );
}

export function NewEpisodeDialog({
  open,
  onOpenChange,
  projectId,
  shows,
  defaultShowId = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  shows: SourceCollection[];
  defaultShowId?: string;
}) {
  const { data: sources } = useSources({ projectId }, { enabled: open });
  const generate = useGeneratePodcast();
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [format, setFormat] = useState<PodcastFormat>("deep_dive");
  const [length, setLength] = useState<PodcastLength>("default");
  const [showDetails, setShowDetails] = useState(false);
  const [title, setTitle] = useState("");
  const [focus, setFocus] = useState("");
  const [showId, setShowId] = useState(defaultShowId);
  const candidates = useMemo(
    () => (sources ?? []).filter((source) => source.kind !== "memory"),
    [sources],
  );

  const reset = () => {
    setSelected(new Set());
    setTitle("");
    setFocus("");
    setShowDetails(false);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="New episode"
      description="Two hosts talk through the sources you choose. It takes a few minutes and appears in Files when it is ready."
      submitText="Make episode"
      submitDisabled={selected.size === 0}
      isLoading={generate.isPending}
      onSubmit={async () => {
        await generate.mutateAsync({
          projectId,
          sourceIds: [...selected],
          title: title.trim() || undefined,
          focus: focus.trim() || undefined,
          format,
          length,
          showId: showId || undefined,
        });
        reset();
        onOpenChange(false);
        toast.success("Episode started. It lands in Files in a few minutes.");
      }}
    >
      <SourcePicker
        sources={candidates}
        selected={selected}
        onToggle={(sourceId) =>
          setSelected((current) => {
            const next = new Set(current);

            if (!next.delete(sourceId)) {
              next.add(sourceId);
            }

            return next;
          })
        }
      />

      <div className="grid gap-4 sm:grid-cols-[3fr_2fr]">
        <FormRadioGroup
          legend="2. How should it sound?"
          value={format}
          options={FORMAT_OPTIONS}
          optionClassName={SELECTED_OPTION}
          onValueChange={setFormat}
        />
        <FormRadioGroup
          legend="Length"
          value={length}
          options={LENGTH_OPTIONS}
          optionClassName={SELECTED_OPTION}
          onValueChange={setLength}
        />
      </div>

      <div className="space-y-3">
        <button
          type="button"
          aria-expanded={showDetails}
          className="flex items-center gap-1 text-sm font-medium text-foreground"
          onClick={() => setShowDetails((current) => !current)}
        >
          <ChevronRight
            size={16}
            className={cn("transition-transform", showDetails && "rotate-90")}
            aria-hidden="true"
          />
          3. Extra details <span className="font-normal text-muted-foreground">(optional)</span>
        </button>
        {showDetails ? (
          <div className="space-y-3 pl-5">
            <FormInput
              label="Title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="The hosts name it if you leave this empty"
            />
            <div className="space-y-1">
              <label htmlFor="podcast-focus" className="text-sm font-medium">
                Focus
              </label>
              <Textarea
                id="podcast-focus"
                value={focus}
                onChange={(event) => setFocus(event.target.value)}
                placeholder="For example: explain it for new starters and spend longest on the risks"
                className="min-h-20"
              />
            </div>
            {shows.length > 0 ? (
              <FormSelect
                label="Publish to show"
                description="Episodes in a show appear in its RSS feed."
                value={showId}
                options={[
                  { value: "", label: "Don't publish" },
                  ...shows.map((show) => ({ value: show.id, label: show.title })),
                ]}
                onValueChange={setShowId}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {generate.error ? (
        <p role="alert" className="text-sm text-failure">
          {generate.error.message}
        </p>
      ) : null}
    </FormDialog>
  );
}
