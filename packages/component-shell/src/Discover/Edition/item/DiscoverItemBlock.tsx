import { isDiscoverListenResearching, type DiscoverEdition } from "@ngriffin_uk/polychat-schemas";
import { useEffect, useState } from "react";

import { useMediaDock } from "../../../Media/MediaDock.js";
import { useEpisodePlayer } from "../../Episode/EpisodePlayer.js";
import { PERCH_GRADIENT, WEEK_GRADIENT } from "../media/discover-art.js";
import { DiscoverEpisodeStage } from "../media/DiscoverEpisodeStage.js";
import { DiscoverListenStage } from "../media/DiscoverListenStage.js";
import { DiscoverWindDownStage } from "../media/DiscoverWindDownStage.js";
import type { DiscoverMedia } from "../media/media-status.js";
import type { DiscoverEditionController } from "../useDiscoverEditionController.js";
import type { DiscoverItem } from "./discover-items.js";
import { DiscoverCardBlock } from "./DiscoverCardBlock.js";
import { DiscoverItemLead } from "./DiscoverItemLead.js";
import type { DiscoverItemSummary } from "./useDiscoverItemSummary.js";

interface LeadProps {
  summary: DiscoverItemSummary;
  chatting: boolean;
  controller: DiscoverEditionController;
  edition: DiscoverEdition;
}

function EpisodeLead({ summary, chatting, controller, edition }: LeadProps) {
  const player = useEpisodePlayer(edition.episodeId);
  const { playback } = player;

  return (
    <DiscoverItemLead
      summary={summary}
      chatting={chatting}
      transport={playback.ready ? { ...playback.track, toggle: playback.toggle } : null}
    >
      <DiscoverEpisodeStage
        edition={edition}
        player={player}
        awaiting={controller.isAwaitingEpisode}
        isRequesting={controller.isRequestingEpisode}
        requestError={controller.requestEpisodeError}
        onRequest={controller.requestEpisode}
        onPlayingChange={controller.setMediaPlaying}
      />
    </DiscoverItemLead>
  );
}

function ListenLead({
  media,
  summary,
  chatting,
  controller,
  edition,
}: LeadProps & { media: "perch" | "week" }) {
  const [openedAt] = useState(Date.now);
  const dock = useMediaDock();
  const perch = media === "perch";
  const sourceId = perch ? edition.listenSourceId : edition.weekSourceId;
  const docked = dock && sourceId && dock.item?.id === sourceId ? dock.track : null;

  return (
    <DiscoverItemLead summary={summary} chatting={chatting} transport={docked}>
      <DiscoverListenStage
        sourceId={sourceId}
        researching={perch && isDiscoverListenResearching(edition, openedAt)}
        eyebrow={summary.kicker}
        dockHref={`/?play=${media}`}
        title={summary.title}
        subtitle={
          perch
            ? "Two hosts dig into today's topics, from the research behind the edition."
            : "What you made, learned and finished. Just for you."
        }
        idleMessage={
          perch
            ? "Two hosts research today's topics, then talk them through in depth."
            : "Your week arrives on Sunday mornings."
        }
        artBackground={perch ? PERCH_GRADIENT : WEEK_GRADIENT}
        isRecording={perch ? controller.isRecordingListen : controller.isRecordingWeek}
        recordError={perch ? controller.recordListenError : controller.recordWeekError}
        onRecord={perch ? controller.recordListen : controller.recordWeek}
        onPlayingChange={controller.setMediaPlaying}
      />
    </DiscoverItemLead>
  );
}

function MediaLead({ media, ...props }: LeadProps & { media: DiscoverMedia }) {
  const { controller } = props;
  const { setMediaPlaying } = controller;

  useEffect(() => () => setMediaPlaying(false), [setMediaPlaying]);

  switch (media) {
    case "episode":
      return <EpisodeLead {...props} />;
    case "perch":
    case "week":
      return <ListenLead {...props} media={media} />;
    case "wind_down":
    case "story":
      return (
        <DiscoverItemLead summary={props.summary} chatting={false}>
          <DiscoverWindDownStage
            key={media === "story" ? controller.storyWindDownId : "wind-down"}
            windDownId={media === "story" ? controller.storyWindDownId : controller.windDownId}
            story={
              media === "story"
                ? { retrying: controller.isStartingStory, onRetry: controller.retryStory }
                : undefined
            }
            onPlayingChange={setMediaPlaying}
          />
        </DiscoverItemLead>
      );
  }
}

export function DiscoverItemBlock({ item, ...props }: LeadProps & { item: DiscoverItem }) {
  if (item.type === "media") {
    return <MediaLead {...props} media={item.media} />;
  }

  const { controller, edition } = props;
  const { card } = item;

  return (
    <DiscoverItemLead summary={props.summary} chatting={props.chatting}>
      <DiscoverCardBlock
        editionId={edition.id}
        card={card}
        cards={edition.cards}
        feedback={controller.feedbackFor(card)}
        onSelect={controller.select}
      />
    </DiscoverItemLead>
  );
}
