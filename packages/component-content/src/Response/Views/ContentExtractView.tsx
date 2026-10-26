import { BoundedMarkdown } from "../BoundedMarkdown";
import { JsonView } from "../JsonView";
import { readContentExtractData } from "./content-extract";
import { YouTubeEmbed } from "./YouTubeEmbed";

export function ContentExtractView({ data }: { data: unknown }) {
  const extract = readContentExtractData(data);

  if (!extract) {
    return null;
  }

  return (
    <div className="space-y-3">
      {extract.videos.map((video) => (
        <YouTubeEmbed key={video.videoId} video={video} />
      ))}
      {extract.summary ? <BoundedMarkdown content={extract.summary} /> : null}
      {extract.failures.length > 0 ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {extract.failures.map((failure) => (
            <li key={failure.url} className="truncate">
              {failure.url}: {failure.error}
            </li>
          ))}
        </ul>
      ) : null}
      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
          Raw response
        </summary>
        <div className="mt-1">
          <JsonView data={data} />
        </div>
      </details>
    </div>
  );
}
