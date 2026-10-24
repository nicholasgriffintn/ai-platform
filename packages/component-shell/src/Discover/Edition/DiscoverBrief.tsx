import { Pet } from "@ngriffin_uk/polychat-component-ui";
import type { DiscoverBriefKind, DiscoverBriefLine } from "@ngriffin_uk/polychat-schemas";
import {
  BellRing,
  CalendarDays,
  CloudSun,
  Feather,
  History,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { DiscoverHref } from "./DiscoverHref.js";

const BRIEF_ICONS: Record<DiscoverBriefKind, { icon: LucideIcon; tone: string }> = {
  waiting: { icon: BellRing, tone: "bg-human-action/15 text-human-action" },
  calendar: { icon: CalendarDays, tone: "bg-active-work/15 text-active-work" },
  topic: { icon: Sparkles, tone: "bg-selection text-foreground" },
  weather: { icon: CloudSun, tone: "bg-selection text-foreground" },
  on_this_day: { icon: History, tone: "bg-selection text-foreground" },
  note: { icon: Feather, tone: "bg-selection text-foreground" },
};

function BriefLine({ line }: { line: DiscoverBriefLine }) {
  const { icon: Icon, tone } = BRIEF_ICONS[line.kind];
  const body = (
    <span className="flex gap-3">
      <span
        className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${tone}`}
      >
        <Icon size={15} aria-hidden />
      </span>
      <span className="min-w-0 text-[0.9rem] leading-snug">
        <span className="text-muted-foreground">{line.label} · </span>
        <span className="font-medium text-foreground">{line.text}</span>
      </span>
    </span>
  );

  return line.href ? (
    <DiscoverHref href={line.href} className="block hover:opacity-80">
      {body}
    </DiscoverHref>
  ) : (
    body
  );
}

export function DiscoverBrief({ lines }: { lines: readonly DiscoverBriefLine[] }) {
  return (
    <section
      aria-label="Brief"
      className="relative overflow-hidden rounded-2xl border border-border bg-surface-elevated p-4 pr-16"
    >
      {lines.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {lines.map((line) => (
            <li key={`${line.label}:${line.text}`}>
              <BriefLine line={line} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">A quiet one. Nothing pressing.</p>
      )}
      <div className="absolute right-1 bottom-0">
        <Pet size={56} placement="top" href={null} showNudges={false} label="Poly" />
      </div>
    </section>
  );
}
