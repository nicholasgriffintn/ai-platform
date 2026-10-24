import { MediaTrackList } from "@ngriffin_uk/polychat-component-ui";
import {
  VIDEO_OVERVIEW_STYLE_LABELS,
  type DiscoverSeasonContent,
} from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

import { EpisodePlayer } from "./EpisodePlayer.js";

export function SeasonView({ season }: { season: DiscoverSeasonContent }) {
  const [selected, setSelected] = useState(Math.max(0, season.episodeIds.length - 1));
  const episodeId = season.episodeIds[selected];

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        A five-part season on {season.topic}, drawn in{" "}
        {VIDEO_OVERVIEW_STYLE_LABELS[season.style].toLowerCase()}.
      </p>
      {episodeId ? <EpisodePlayer key={episodeId} episodeId={episodeId} /> : null}
      <MediaTrackList
        label="Parts"
        items={season.parts.map((part, index) => ({
          key: `${index}:${part.title}`,
          title: part.title,
          detail: part.angle,
          status: season.episodeIds[index]
            ? { state: "ready", label: `Part ${index + 1}` }
            : { state: "idle", label: "Coming" },
          active: index === selected && Boolean(episodeId),
          onPlay: season.episodeIds[index] ? () => setSelected(index) : undefined,
        }))}
      />
    </div>
  );
}
