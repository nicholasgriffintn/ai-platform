import { MediaNotice, MediaNoticeAction } from "@ngriffin_uk/polychat-component-ui";
import type { DiscoverEdition } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { Clapperboard, RotateCcw } from "lucide-react";

import { episodeStatus } from "../../Episode/episode-status.js";
import {
  EpisodePlayerView,
  episodeHeading,
  type EpisodePlayerState,
} from "../../Episode/EpisodePlayer.js";
import { DiscoverStage } from "./DiscoverStage.js";

export function DiscoverEpisodeStage({
  edition,
  player,
  awaiting,
  isRequesting,
  requestError,
  onRequest,
  onPlayingChange,
}: {
  edition: DiscoverEdition;
  player: EpisodePlayerState;
  awaiting: boolean;
  isRequesting: boolean;
  requestError: unknown;
  onRequest: () => void;
  onPlayingChange: (playing: boolean) => void;
}) {
  const { episode } = player;
  const status = episodeStatus(edition, episode, awaiting);
  const topic = edition.interests[0]?.topic ?? null;
  const heading = episodeHeading(episode);

  return (
    <DiscoverStage eyebrow={heading.eyebrow} title={heading.title} subtitle={heading.recap}>
      <EpisodePlayerView
        player={player}
        seasonAction={false}
        onPlayingChange={onPlayingChange}
        placeholder={
          edition.episodeOverBudget ? (
            <MediaNotice
              status={status}
              message="This month's Discover budget is spent. Raise it in settings to make today's part."
              action={
                <MediaNoticeAction
                  icon={<Clapperboard size={15} aria-hidden />}
                  label="Try again"
                  disabled={isRequesting}
                  onClick={onRequest}
                />
              }
            />
          ) : status.state === "failed" ? (
            <MediaNotice
              status={status}
              message="Today's episode didn't take."
              action={
                <MediaNoticeAction
                  icon={<RotateCcw size={15} aria-hidden />}
                  label="Try again"
                  disabled={isRequesting}
                  onClick={onRequest}
                />
              }
            />
          ) : awaiting ? (
            <MediaNotice
              status={status}
              message="Outlining today's part. Each chapter plays as soon as it's recorded."
            />
          ) : (
            <MediaNotice
              status={status}
              message={
                topic
                  ? `Today's part of a five-day season on ${topic}.`
                  : "Today's part of a five-day season on your top topic."
              }
              action={
                <MediaNoticeAction
                  icon={<Clapperboard size={15} aria-hidden />}
                  label="Make it"
                  disabled={isRequesting}
                  onClick={onRequest}
                />
              }
            />
          )
        }
      />
      {requestError ? (
        <p className="text-xs text-failure">
          {getErrorMessage(requestError, "The episode could not be started")}
        </p>
      ) : null}
    </DiscoverStage>
  );
}
