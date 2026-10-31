import { Button, OptionsMenu, OptionsMenuAction } from "@ngriffin_uk/polychat-component-ui";
import {
  useDiscoverEpisode,
  useQueueDiscoverSeasonListen,
} from "@ngriffin_uk/polychat-library-react";
import { Check, MoreHorizontal, Podcast } from "lucide-react";

export function DiscoverEpisodeMenu({ episodeId }: { episodeId: string }) {
  const episode = useDiscoverEpisode(episodeId).data;
  const seasonListen = useQueueDiscoverSeasonListen();

  return (
    <OptionsMenu
      align="end"
      trigger={
        <Button
          variant="icon"
          size="sm"
          aria-label="More options"
          title="More options"
          disabled={!episode}
          icon={<MoreHorizontal size={15} aria-hidden />}
        />
      }
    >
      <OptionsMenuAction
        disabled={!episode || seasonListen.isPending || seasonListen.isSuccess}
        onSelect={() => episode && seasonListen.mutate(episode.seasonId)}
      >
        <Podcast size={14} aria-hidden />
        <span className="flex-1">
          {seasonListen.isSuccess ? "Saving to The Perch" : "Save the season as one listen"}
        </span>
        {seasonListen.isSuccess ? <Check size={14} aria-hidden /> : null}
      </OptionsMenuAction>
    </OptionsMenu>
  );
}
