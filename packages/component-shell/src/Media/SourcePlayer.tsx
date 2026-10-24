import { MediaPlayer, type MediaPlayerProps } from "@ngriffin_uk/polychat-component-ui";
import { getSourceContentUrl, getSourceCoverUrl } from "@ngriffin_uk/polychat-library-client";
import { useSource } from "@ngriffin_uk/polychat-library-react";
import { getSourceMediaType, readSourceMedia } from "@ngriffin_uk/polychat-schemas";

export interface SourcePlayerProps extends Pick<
  MediaPlayerProps,
  "artBackground" | "notice" | "actions" | "className" | "onPlayingChange" | "showTranscriptList"
> {
  sourceId: string | null;
  title?: string;
}

export function SourcePlayer({ sourceId, title, ...player }: SourcePlayerProps) {
  const source = useSource(sourceId).data;
  const media = source ? readSourceMedia(source.metadata) : null;
  const playable = source?.status === "available" && Boolean(source.file);
  const transcript = media?.transcript?.status === "ready" ? media.transcript : null;

  return (
    <MediaPlayer
      {...player}
      kind={getSourceMediaType(source?.file?.mimeType) === "video" ? "video" : "audio"}
      src={source && playable ? getSourceContentUrl(source.id) : null}
      title={title ?? source?.title ?? ""}
      crossOrigin="use-credentials"
      art={source && playable && media?.cover ? getSourceCoverUrl(source.id) : null}
      transcript={
        transcript ? { segments: transcript.segments, speakers: transcript.speakers } : undefined
      }
    />
  );
}
