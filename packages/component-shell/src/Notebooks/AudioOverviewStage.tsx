import { useSource } from "@ngriffin_uk/polychat-library-react";
import { readSourceMedia } from "@ngriffin_uk/polychat-schemas";

import { SourcePlayer } from "../Media/SourcePlayer.js";

export function AudioOverviewStage({ sourceId }: { sourceId: string }) {
  const { data: source } = useSource(sourceId);
  const summary = source ? readSourceMedia(source.metadata).notes?.summary : undefined;

  return (
    <div className="flex flex-col gap-4">
      {summary ? <p className="text-sm text-muted-foreground">{summary}</p> : null}
      <SourcePlayer sourceId={sourceId} />
    </div>
  );
}
