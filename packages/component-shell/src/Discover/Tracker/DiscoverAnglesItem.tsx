import { useCoverageTracker } from "@ngriffin_uk/polychat-library-react";
import { formatShortCalendarDate } from "@ngriffin_uk/polychat-utility-core";
import type { Ref } from "react";

import { discoverItemKind } from "../Edition/item/discover-item-kind.js";
import { discoverItemKey } from "../Edition/item/discover-items.js";
import { DiscoverGraphFrame, DiscoverGraphStatus } from "../Story/DiscoverGraphFrame.js";
import { StorySection } from "../Story/StorySection.js";
import { COVERAGE_TRACKER_WEEKS } from "./angles-week.js";
import { AttentionHeatmap } from "./AttentionHeatmap.js";
import { DroppedOffList } from "./DroppedOffList.js";
import { TermTrends } from "./TermTrends.js";
import { TopicShareChart } from "./TopicShareChart.js";
import { WeekAttentionBars } from "./WeekAttentionBars.js";
import { WeekNames } from "./WeekNames.js";

export function DiscoverAnglesItem({
  contentRef,
  onOpenStory,
  onOpenEntity,
  onClose,
}: {
  contentRef: Ref<HTMLDivElement>;
  onOpenStory: (storyId: string) => void;
  onOpenEntity: (entityId: string) => void;
  onClose: () => void;
}) {
  const { data, error } = useCoverageTracker(COVERAGE_TRACKER_WEEKS);

  return (
    <DiscoverGraphFrame
      kind={discoverItemKind({ type: "angles" })}
      itemKey={discoverItemKey({ type: "angles" })}
      contentRef={contentRef}
      onClose={onClose}
    >
      {data ? (
        <article className="flex min-w-0 flex-col gap-7">
          <header data-stagger className="flex flex-col gap-2">
            <p className="polychat-eyebrow">
              {data.until ? `Up to ${formatShortCalendarDate(data.until)}` : "Your outlets"}
            </p>
            <h2 className="font-display text-2xl leading-tight font-medium tracking-tight text-balance text-foreground sm:text-[1.75rem]">
              What your outlets paid attention to
            </h2>
            <p className="text-sm text-muted-foreground">
              {data.until
                ? "Counts come from nightly roll-ups of every article Discover reads."
                : "Coverage appears here after the first nightly roll-up."}
            </p>
          </header>
          <StorySection title="This week and last">
            <WeekAttentionBars tracker={data} />
          </StorySection>
          <StorySection title="Names rising and fading">
            <WeekNames tracker={data} onOpenEntity={onOpenEntity} />
          </StorySection>
          <StorySection title="Losing coverage">
            <DroppedOffList stories={data.droppedOff} onOpenStory={onOpenStory} />
          </StorySection>
          {data.until ? (
            <>
              <StorySection title="Topic share, eight weeks">
                <TopicShareChart tracker={data} />
              </StorySection>
              <StorySection title="Who covers what, last four weeks">
                <AttentionHeatmap tracker={data} />
              </StorySection>
              <StorySection title="Names in the news">
                <TermTrends tracker={data} onOpenEntity={onOpenEntity} />
              </StorySection>
            </>
          ) : null}
        </article>
      ) : (
        <DiscoverGraphStatus
          error={error}
          missing="Angles are not available yet."
          failed="Could not load Angles. Try again shortly."
        />
      )}
    </DiscoverGraphFrame>
  );
}
