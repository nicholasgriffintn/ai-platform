import type { YouTubeVideo } from "@ngriffin_uk/polychat-schemas";
import { youTubeEmbedUrl } from "@ngriffin_uk/polychat-utility-core";

const YOUTUBE_EMBED_SANDBOX =
  "allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox";

export function YouTubeEmbed({ video }: { video: YouTubeVideo }) {
  const title = video.title ?? "YouTube video";

  return (
    <figure className="overflow-hidden rounded-md border border-border">
      <iframe
        src={youTubeEmbedUrl(video.videoId)}
        title={title}
        className="aspect-video w-full"
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox={YOUTUBE_EMBED_SANDBOX}
        allowFullScreen
      />
      <figcaption className="flex min-w-0 items-baseline gap-2 px-3 py-2 text-sm">
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 truncate font-medium text-foreground hover:underline"
        >
          {title}
        </a>
        {video.author ? (
          <span className="shrink-0 text-xs text-muted-foreground">{video.author}</span>
        ) : null}
      </figcaption>
    </figure>
  );
}
