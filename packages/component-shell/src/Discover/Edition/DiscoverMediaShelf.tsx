import { MediaTile } from "@ngriffin_uk/polychat-component-ui";
import { getSourceCoverUrl } from "@ngriffin_uk/polychat-library-client";
import {
  useDiscoverEpisode,
  useDiscoverWindDown,
  useSource,
} from "@ngriffin_uk/polychat-library-react";
import {
  isDiscoverListenResearching,
  readSourceMedia,
  type DiscoverEdition,
} from "@ngriffin_uk/polychat-schemas";
import { useState, type ReactNode } from "react";

import { episodeCoverUrl } from "../Episode/episode-cover.js";
import { episodeStatus } from "../Episode/episode-status.js";
import { DISCOVER_SHELF_VISIBLE, DiscoverSection } from "./DiscoverSection.js";
import { discoverTopicGradient } from "./DiscoverTopicTile.js";
import { PERCH_GRADIENT, WEEK_GRADIENT } from "./media/discover-art.js";
import { listenStatus, windDownStatus, type DiscoverMedia } from "./media/media-status.js";
import { WindDownScene } from "./media/WindDownScene.js";

export function DiscoverArt({ background, image }: { background: string; image?: string | null }) {
  return (
    <span data-discover-art className="absolute inset-0" style={{ background }}>
      {image ? (
        <img
          src={image}
          crossOrigin="use-credentials"
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
    </span>
  );
}

export function DiscoverSceneArt({ children }: { children: ReactNode }) {
  return (
    <span data-discover-art className="absolute inset-0">
      {children}
    </span>
  );
}

export function DiscoverMediaShelf({
  edition,
  media,
  awaitingEpisode,
  windDownId,
  active,
  onOpen,
}: {
  edition: DiscoverEdition;
  media: readonly DiscoverMedia[];
  awaitingEpisode: boolean;
  windDownId: string | null;
  active: DiscoverMedia | null;
  onOpen: (media: DiscoverMedia) => void;
}) {
  const [openedAt] = useState(Date.now);
  const episode = useDiscoverEpisode(edition.episodeId).data;
  const perch = useSource(edition.listenSourceId ?? null).data;
  const week = useSource(edition.weekSourceId ?? null).data;
  const windDown = useDiscoverWindDown(windDownId).data;
  const perchReady = perch?.status === "available" && readSourceMedia(perch.metadata).cover;
  const weekReady = week?.status === "available" && readSourceMedia(week.metadata).cover;

  const tile = (entry: DiscoverMedia) => {
    switch (entry) {
      case "episode":
        return (
          <MediaTile
            art={
              <DiscoverArt
                background={discoverTopicGradient(
                  episode?.topic ?? edition.interests[0]?.topic ?? "episode",
                )}
                image={episode ? episodeCoverUrl(episode) : null}
              />
            }
            eyebrow={
              episode
                ? `Episode · ${episode.topic} · Part ${episode.part} of ${episode.parts}`
                : "Today's episode"
            }
            title={episode?.title ?? edition.interests[0]?.topic ?? "Today's episode"}
            status={episodeStatus(edition, episode, awaitingEpisode)}
            selected={active === "episode"}
            onSelect={() => onOpen("episode")}
          />
        );
      case "week":
        return (
          <MediaTile
            art={
              <DiscoverArt
                background={WEEK_GRADIENT}
                image={week && weekReady ? getSourceCoverUrl(week.id) : null}
              />
            }
            eyebrow="Your week"
            title="Your week, told back"
            status={listenStatus(edition.weekSourceId, week)}
            selected={active === "week"}
            onSelect={() => onOpen("week")}
          />
        );
      case "perch":
        return (
          <MediaTile
            art={
              <DiscoverArt
                background={PERCH_GRADIENT}
                image={perch && perchReady ? getSourceCoverUrl(perch.id) : null}
              />
            }
            eyebrow="The Perch"
            title="Today's round-up"
            status={listenStatus(
              edition.listenSourceId,
              perch,
              isDiscoverListenResearching(edition, openedAt),
            )}
            selected={active === "perch"}
            onSelect={() => onOpen("perch")}
          />
        );
      case "wind_down":
        return (
          <MediaTile
            art={
              <DiscoverSceneArt>
                <WindDownScene
                  bed={windDown?.bed ?? "night"}
                  seed={windDown?.id ?? "wind-down"}
                  moving={false}
                />
              </DiscoverSceneArt>
            }
            eyebrow="Wind down"
            title={windDown?.title ?? "Something quieter"}
            status={windDownStatus(windDown)}
            selected={active === "wind_down"}
            onSelect={() => onOpen("wind_down")}
          />
        );
      case "story":
        return null;
    }
  };

  return (
    <DiscoverSection
      title="Watch and listen"
      kind="posters"
      count={media.length}
      maxVisible={DISCOVER_SHELF_VISIBLE.watch}
    >
      {media.map((entry) => (
        <div key={entry} data-discover-item={`media:${entry}`} className="flex">
          {tile(entry)}
        </div>
      ))}
    </DiscoverSection>
  );
}
