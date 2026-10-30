import { MediaPlayer, type MediaPlayerProps } from "@ngriffin_uk/polychat-component-ui";
import { getSourceContentUrl, getSourceCoverUrl } from "@ngriffin_uk/polychat-library-client";
import { useSource } from "@ngriffin_uk/polychat-library-react";
import { getSourceMediaType, readSourceMedia } from "@ngriffin_uk/polychat-schemas";
import { useEffect } from "react";

import { useMediaDock, type MediaDockValue } from "./MediaDock.js";

export interface SourcePlayerDock {
  href: string;
  subtitle?: string;
}

export interface SourcePlayerProps extends Pick<
  MediaPlayerProps,
  "artBackground" | "notice" | "actions" | "className" | "onPlayingChange" | "showTranscriptList"
> {
  sourceId: string | null;
  title?: string;
  dock?: SourcePlayerDock;
}

function useDockedTrack(
  dock: MediaDockValue | null,
  item: { id: string; src: string; title: string; artBackground?: string } | null,
  link: SourcePlayerDock | undefined,
) {
  const docked = Boolean(dock && link && item);
  const itemId = item?.id ?? null;
  const src = item?.src ?? null;
  const title = item?.title ?? "";
  const artBackground = item?.artBackground;
  const load = dock?.load;
  const present = dock?.present;
  const href = link?.href;
  const subtitle = link?.subtitle;

  useEffect(() => {
    if (!docked || !load || !itemId || !src || !href) {
      return;
    }

    load({
      id: itemId,
      src,
      title,
      subtitle,
      artBackground,
      crossOrigin: "use-credentials",
      href,
    });
  }, [artBackground, docked, href, itemId, load, src, subtitle, title]);

  useEffect(
    () => (docked && present && itemId ? present(itemId) : undefined),
    [docked, itemId, present],
  );

  return docked && dock && dock.item?.id === itemId ? dock.track : undefined;
}

export function SourcePlayer({ sourceId, title, dock: link, ...player }: SourcePlayerProps) {
  const source = useSource(sourceId).data;
  const media = source ? readSourceMedia(source.metadata) : null;
  const playable = source?.status === "available" && Boolean(source.file);
  const transcript = media?.transcript?.status === "ready" ? media.transcript : null;
  const kind = getSourceMediaType(source?.file?.mimeType) === "video" ? "video" : "audio";
  const src = source && playable ? getSourceContentUrl(source.id) : null;
  const resolvedTitle = title ?? source?.title ?? "";
  const dock = useMediaDock();
  const sharedTrack = useDockedTrack(
    dock,
    kind === "audio" && source && src
      ? { id: source.id, src, title: resolvedTitle, artBackground: player.artBackground }
      : null,
    link,
  );

  return (
    <MediaPlayer
      {...player}
      kind={kind}
      src={src}
      title={resolvedTitle}
      crossOrigin="use-credentials"
      art={source && playable && media?.cover ? getSourceCoverUrl(source.id) : null}
      transcript={
        transcript ? { segments: transcript.segments, speakers: transcript.speakers } : undefined
      }
      track={sharedTrack}
      hostsMedia={!sharedTrack}
    />
  );
}
