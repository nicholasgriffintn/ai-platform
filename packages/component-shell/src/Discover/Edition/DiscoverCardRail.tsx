import { WorkbenchCard } from "@ngriffin_uk/polychat-component-ui";
import type { DiscoverCard } from "@ngriffin_uk/polychat-schemas";
import { Info } from "lucide-react";

import { SourceListenById } from "../../Files/Viewer/SourceListen.js";
import { discoverCardBody } from "./discover-card-drafts.js";
import { DiscoverCoverageCard } from "./DiscoverCoverage.js";
import { DiscoverFramingCard } from "./DiscoverFraming.js";

export function DiscoverCardRail({
  editionId,
  card,
  topicArticleCount,
}: {
  editionId: string;
  card: DiscoverCard;
  topicArticleCount: number;
}) {
  const body = discoverCardBody(card);
  const sourceId = card.kind === "read" ? card.sourceId : undefined;

  return (
    <>
      <WorkbenchCard title="About this" icon={Info}>
        <div className="flex flex-col gap-2.5">
          {body ? <p className="text-[0.8125rem] leading-relaxed text-foreground">{body}</p> : null}
          <p>
            <span className="font-medium text-foreground">Why this: </span>
            {card.reason}
          </p>
          {sourceId ? <SourceListenById sourceId={sourceId} /> : null}
        </div>
      </WorkbenchCard>
      {sourceId ? (
        <DiscoverFramingCard editionId={editionId} cardId={card.id} sourceId={sourceId} />
      ) : null}
      {card.kind === "topic" ? (
        <DiscoverCoverageCard
          editionId={editionId}
          cardId={card.id}
          coverageSourceId={card.coverageSourceId}
          articleCount={topicArticleCount}
        />
      ) : null}
    </>
  );
}
