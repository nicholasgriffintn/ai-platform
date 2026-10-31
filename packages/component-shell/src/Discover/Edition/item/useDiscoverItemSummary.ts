import { discoverCardSubject } from "@ngriffin_uk/polychat-library-chat";
import { getSourceCoverUrl } from "@ngriffin_uk/polychat-library-client";
import {
  useDiscoverEpisode,
  useDiscoverWindDown,
  useSource,
} from "@ngriffin_uk/polychat-library-react";
import {
  readSourceMedia,
  type ConversationSubject,
  type ConversationSubjectType,
  type DiscoverCard,
  type DiscoverEdition,
  type Source,
} from "@ngriffin_uk/polychat-schemas";
import { useMemo } from "react";

import { episodeCoverUrl } from "../../Episode/episode-cover.js";
import { episodeHeading } from "../../Episode/EpisodePlayer.js";
import { discoverCardEyebrow, discoverCardHeadline } from "../discover-card-drafts.js";
import { discoverTopicGradient } from "../DiscoverTopicTile.js";
import { NIGHT_GRADIENT, PERCH_GRADIENT, WEEK_GRADIENT } from "../media/discover-art.js";
import type { DiscoverItem } from "./discover-items.js";

export type DiscoverItemArt =
  | { type: "image"; background: string; image: string | null }
  | { type: "card"; card: DiscoverCard };

export interface DiscoverItemSummary {
  title: string;
  kicker: string;
  art: DiscoverItemArt;
  subject: ConversationSubject | null;
}

interface SummaryFields extends Omit<DiscoverItemSummary, "subject"> {
  subject: { type: ConversationSubjectType; id: string } | null;
}

function sourceCover(source: Source | undefined): string | null {
  return source?.status === "available" && readSourceMedia(source.metadata).cover
    ? getSourceCoverUrl(source.id)
    : null;
}

function useSummaryFields(
  item: DiscoverItem,
  edition: DiscoverEdition,
  windDownId: string | null,
): SummaryFields {
  const media = item.type === "media" ? item.media : null;
  const episode = useDiscoverEpisode(media === "episode" ? edition.episodeId : undefined).data;
  const listenId =
    media === "perch" ? edition.listenSourceId : media === "week" ? edition.weekSourceId : null;
  const source = useSource(listenId ?? null).data;
  const windDown = useDiscoverWindDown(
    media === "wind_down" || media === "story" ? windDownId : null,
  ).data;

  if (item.type === "card") {
    const { card } = item;

    return {
      title: discoverCardHeadline(card),
      kicker: discoverCardEyebrow(card),
      art: { type: "card", card },
      subject: card.kind === "wind_down" ? null : discoverCardSubject(edition.id, card),
    };
  }

  switch (item.media) {
    case "episode": {
      const heading = episodeHeading(episode);

      return {
        title: heading.title,
        kicker: heading.eyebrow,
        art: {
          type: "image",
          background: discoverTopicGradient(
            episode?.topic ?? edition.interests[0]?.topic ?? "episode",
          ),
          image: episode ? episodeCoverUrl(episode) : null,
        },
        subject: edition.episodeId ? { type: "output", id: edition.episodeId } : null,
      };
    }

    case "perch":
    case "week": {
      const perch = item.media === "perch";

      return {
        title: perch ? "Today's round-up" : "Your week, told back",
        kicker: perch ? "The Perch" : "Your week",
        art: {
          type: "image",
          background: perch ? PERCH_GRADIENT : WEEK_GRADIENT,
          image: sourceCover(source),
        },
        subject:
          listenId && (!source || source.status === "available")
            ? { type: "source", id: listenId }
            : null,
      };
    }

    case "wind_down":
    case "story":
      return {
        title: windDown?.title ?? "Something quieter",
        kicker: item.media === "story" ? "Tonight's story" : "Wind down",
        art: { type: "image", background: NIGHT_GRADIENT, image: null },
        subject: null,
      };
  }
}

export function useDiscoverItemSummary(
  item: DiscoverItem,
  edition: DiscoverEdition,
  windDownId: string | null,
): DiscoverItemSummary {
  const fields = useSummaryFields(item, edition, windDownId);
  const subjectType = fields.subject?.type;
  const subjectId = fields.subject?.id;
  const subject = useMemo(
    () => (subjectType && subjectId ? { type: subjectType, id: subjectId } : null),
    [subjectId, subjectType],
  );

  return { ...fields, subject };
}
