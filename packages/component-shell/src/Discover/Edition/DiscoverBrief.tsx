import type { DiscoverBriefKind, DiscoverBriefLine } from "@ngriffin_uk/polychat-schemas";
import { useHorizontalScroller } from "@ngriffin_uk/polychat-utility-react";
import {
  BellRing,
  CalendarDays,
  CloudSun,
  Feather,
  History,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { DiscoverCarouselControls, DiscoverCarouselFade } from "./DiscoverCarousel.js";
import { DiscoverHref } from "./DiscoverHref.js";

const BRIEF_TRACK =
  "flex flex-col gap-4 [scrollbar-width:none] @md/brief:snap-x @md/brief:snap-mandatory @md/brief:flex-row @md/brief:gap-6 @md/brief:overflow-x-auto [&::-webkit-scrollbar]:hidden";

const BRIEF_ICONS: Record<DiscoverBriefKind, { icon: LucideIcon; tone: string }> = {
  waiting: { icon: BellRing, tone: "text-human-action" },
  calendar: { icon: CalendarDays, tone: "text-active-work" },
  topic: { icon: Sparkles, tone: "text-muted-foreground" },
  weather: { icon: CloudSun, tone: "text-muted-foreground" },
  on_this_day: { icon: History, tone: "text-muted-foreground" },
  note: { icon: Feather, tone: "text-muted-foreground" },
};

function BriefLine({ line }: { line: DiscoverBriefLine }) {
  const { icon: Icon, tone } = BRIEF_ICONS[line.kind];
  const body = (
    <span className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon size={13} className={tone} aria-hidden />
        {line.label}
      </span>
      <span className="text-[0.9rem] leading-snug text-foreground">{line.text}</span>
    </span>
  );

  return line.href ? (
    <DiscoverHref href={line.href} className="block no-underline hover:opacity-80">
      {body}
    </DiscoverHref>
  ) : (
    body
  );
}

export function DiscoverBrief({ lines }: { lines: readonly DiscoverBriefLine[] }) {
  const { ref: trackRef, ...scroller } = useHorizontalScroller<HTMLUListElement>();

  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">A quiet one. Nothing pressing.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <ul ref={trackRef} aria-label="Brief" className={BRIEF_TRACK}>
          {lines.map((line) => (
            <li
              key={`${line.label}:${line.text}`}
              className="min-w-0 @md/brief:shrink-0 @md/brief:basis-[calc((100%-1.5rem)/2)] @md/brief:snap-start @3xl/brief:basis-[calc((100%-3rem)/3)]"
            >
              <BriefLine line={line} />
            </li>
          ))}
        </ul>
        <DiscoverCarouselFade scroller={scroller} />
      </div>
      <DiscoverCarouselControls scroller={scroller} label="the brief" className="justify-end" />
    </div>
  );
}
