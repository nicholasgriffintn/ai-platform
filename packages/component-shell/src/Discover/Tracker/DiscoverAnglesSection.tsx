import { Button } from "@ngriffin_uk/polychat-component-ui";
import { useCoverageTracker } from "@ngriffin_uk/polychat-library-react";
import type { CoverageTracker } from "@ngriffin_uk/polychat-schemas";
import { formatCount } from "@ngriffin_uk/polychat-utility-core";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { DiscoverShelfHeading } from "../Edition/DiscoverSection.js";
import { COVERAGE_TRACKER_WEEKS, hasWeekCoverage } from "./angles-week.js";
import { DroppedOffList } from "./DroppedOffList.js";
import { WeekAttentionBars } from "./WeekAttentionBars.js";
import { WeekNames } from "./WeekNames.js";

const TITLE = "This week";
const OUTLET_LIMIT = 4;
const NAME_LIMIT = 3;
const DROPPED_LIMIT = 2;

export interface DiscoverAnglesActions {
  onOpenStory: (storyId: string) => void;
  onOpenEntity: (entityId: string) => void;
  onOpenAngles: () => void;
}

function AnglesPart({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-2 border-t border-border pt-3">
      <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
      {children}
    </section>
  );
}

function AnglesLead({
  lead,
  onOpenStory,
}: {
  lead: NonNullable<CoverageTracker["thisWeek"]["lead"]>;
  onOpenStory: (storyId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenStory(lead.story.id)}
      className="group text-left text-sm leading-snug text-pretty text-muted-foreground focus-visible:ring-2 focus-visible:ring-active-work focus-visible:outline-none"
    >
      <span className="font-display text-base text-foreground group-hover:underline group-hover:underline-offset-4">
        {lead.story.title}
      </span>{" "}
      leads your outlets this week with {formatCount(lead.articleCount, "article")}.
    </button>
  );
}

function AnglesCard({
  tracker,
  onOpenStory,
  onOpenEntity,
}: Omit<DiscoverAnglesActions, "onOpenAngles"> & { tracker: CoverageTracker }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      {tracker.thisWeek.lead ? (
        <AnglesLead lead={tracker.thisWeek.lead} onOpenStory={onOpenStory} />
      ) : null}
      <AnglesPart title="Names rising and fading">
        <WeekNames tracker={tracker} limit={NAME_LIMIT} onOpenEntity={onOpenEntity} />
      </AnglesPart>
      <AnglesPart title="Attention, this week and last">
        <WeekAttentionBars tracker={tracker} limit={OUTLET_LIMIT} />
      </AnglesPart>
      {tracker.droppedOff.length > 0 ? (
        <AnglesPart title="Losing coverage">
          <DroppedOffList
            stories={tracker.droppedOff}
            limit={DROPPED_LIMIT}
            onOpenStory={onOpenStory}
          />
        </AnglesPart>
      ) : null}
    </div>
  );
}

export function DiscoverAnglesSection({
  enabled,
  ...actions
}: DiscoverAnglesActions & { enabled: boolean }) {
  const { data } = useCoverageTracker(COVERAGE_TRACKER_WEEKS, enabled);

  if (!enabled || !data) {
    return null;
  }

  const ready = hasWeekCoverage(data);
  const outletCount = data.heatmap.outlets.length || data.thisWeek.outlets.length;

  return (
    <section aria-label={TITLE} className="flex min-w-0 flex-col gap-3">
      <DiscoverShelfHeading
        title={TITLE}
        controls={
          ready ? (
            <Button variant="ghost" size="xs" onClick={actions.onOpenAngles}>
              See all
              <ArrowRight size={13} aria-hidden />
            </Button>
          ) : null
        }
      />
      {ready ? (
        <AnglesCard
          tracker={data}
          onOpenStory={actions.onOpenStory}
          onOpenEntity={actions.onOpenEntity}
        />
      ) : (
        <p className="rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-muted-foreground">
          {outletCount > 0
            ? `Discover is watching ${formatCount(outletCount, "outlet")}; the first week fills in as stories arrive.`
            : "Discover is watching your outlets; the first week fills in as stories arrive."}
        </p>
      )}
    </section>
  );
}
