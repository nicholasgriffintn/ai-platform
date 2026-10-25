import { MediaTile } from "@ngriffin_uk/polychat-component-ui";
import { getSourceCoverUrl } from "@ngriffin_uk/polychat-library-client";
import {
  useDiscoverEpisode,
  useDiscoverWindDown,
  useSource,
} from "@ngriffin_uk/polychat-library-react";
import { readSourceMedia, type DiscoverEdition } from "@ngriffin_uk/polychat-schemas";

import { episodeCoverUrl } from "../Episode/episode-cover.js";
import { episodeStatus } from "../Episode/episode-status.js";
import { discoverTopicGradient } from "./DiscoverTopicTile.js";
import { PERCH_GRADIENT, WEEK_GRADIENT } from "./media/discover-art.js";
import { listenStatus, windDownStatus, type DiscoverMedia } from "./media/media-status.js";
import { WindDownScene } from "./media/WindDownScene.js";

function Art({ background, image }: { background: string; image?: string | null }) {
  return (
    <>
      <span aria-hidden className="absolute inset-0" style={{ background }} />
      {image ? (
        <img
          src={image}
          crossOrigin="use-credentials"
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
    </>
  );
}

export function DiscoverMediaShelf({
  edition,
  showEpisode,
  awaitingEpisode,
  windDownId,
  active,
  onOpen,
}: {
  edition: DiscoverEdition;
  showEpisode: boolean;
  awaitingEpisode: boolean;
  windDownId: string | null;
  active: DiscoverMedia | null;
  onOpen: (media: DiscoverMedia) => void;
}) {
  const episode = useDiscoverEpisode(edition.episodeId).data;
  const perch = useSource(edition.listenSourceId ?? null).data;
  const week = useSource(edition.weekSourceId ?? null).data;
  const windDown = useDiscoverWindDown(windDownId).data;
  const perchReady = perch?.status === "available" && readSourceMedia(perch.metadata).cover;
  const weekReady = week?.status === "available" && readSourceMedia(week.metadata).cover;

  return (
    <section className="flex flex-col gap-3">
      <h3 className="polychat-eyebrow px-1">Watch and listen</h3>
      {showEpisode && (
        <MediaTile
          wide
          art={
            <Art
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
      )}
      <div className="grid grid-cols-2 gap-3">
        {edition.weekSourceId ? (
          <MediaTile
            art={
              <Art
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
        ) : null}
        <MediaTile
          art={
            <Art
              background={PERCH_GRADIENT}
              image={perch && perchReady ? getSourceCoverUrl(perch.id) : null}
            />
          }
          eyebrow="The Perch"
          title="Today's round-up"
          status={listenStatus(edition.listenSourceId, perch)}
          selected={active === "perch"}
          onSelect={() => onOpen("perch")}
        />
        <MediaTile
          art={
            <WindDownScene
              bed={windDown?.bed ?? "night"}
              seed={windDown?.id ?? "wind-down"}
              moving={false}
            />
          }
          eyebrow="Wind down"
          title={windDown?.title ?? "Something quieter"}
          status={windDownStatus(windDown)}
          selected={active === "wind_down"}
          onSelect={() => onOpen("wind_down")}
        />
      </div>
    </section>
  );
}
