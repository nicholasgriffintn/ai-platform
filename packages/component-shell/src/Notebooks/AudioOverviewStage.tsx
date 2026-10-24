import { getSourceContentUrl, getSourceCoverUrl } from "@ngriffin_uk/polychat-library-client";
import { useSource } from "@ngriffin_uk/polychat-library-react";
import { readSourceMedia } from "@ngriffin_uk/polychat-schemas";

export function AudioOverviewStage({ sourceId }: { sourceId: string }) {
  const { data: source } = useSource(sourceId);

  if (!source) {
    return null;
  }

  const media = readSourceMedia(source.metadata);
  const segments = media.transcript?.segments ?? [];
  const speakers = media.transcript?.speakers ?? {};

  return (
    <div className="flex flex-col gap-4">
      {media.cover ? (
        <img
          src={getSourceCoverUrl(source.id)}
          alt=""
          crossOrigin="use-credentials"
          className="aspect-square w-full rounded-xl object-cover"
        />
      ) : null}
      <audio
        controls
        preload="metadata"
        crossOrigin="use-credentials"
        src={getSourceContentUrl(source.id)}
        aria-label={source.title}
        className="w-full"
      >
        <track kind="captions" />
      </audio>
      {media.notes?.summary ? (
        <p className="text-sm text-muted-foreground">{media.notes.summary}</p>
      ) : null}
      {segments.length > 0 ? (
        <ol className="flex flex-col gap-3 border-t border-border pt-3">
          {segments.map((segment, index) => (
            <li key={`${segment.start ?? index}:${segment.text.slice(0, 24)}`} className="text-sm">
              {segment.speaker ? (
                <span className="font-medium text-foreground">
                  {speakers[segment.speaker] ?? segment.speaker}:{" "}
                </span>
              ) : null}
              <span className="text-muted-foreground">{segment.text}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
