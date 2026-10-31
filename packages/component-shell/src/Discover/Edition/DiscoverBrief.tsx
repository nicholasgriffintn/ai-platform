import { cn } from "@ngriffin_uk/polychat-component-ui";
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

const WIDE_COLUMNS = [
  "@3xl/brief:grid-cols-1",
  "@3xl/brief:grid-cols-2",
  "@3xl/brief:grid-cols-3",
  "@3xl/brief:grid-cols-4",
] as const;

function wideColumns(count: number): string {
  return WIDE_COLUMNS[Math.min(count, WIDE_COLUMNS.length) - 1];
}

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
  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">A quiet one. Nothing pressing.</p>;
  }

  return (
    <ul
      aria-label="Brief"
      className={cn(
        "grid grid-cols-1 gap-x-6 gap-y-4 @md/brief:grid-cols-2",
        wideColumns(lines.length),
      )}
    >
      {lines.map((line) => (
        <li key={`${line.label}:${line.text}`} className="min-w-0">
          <BriefLine line={line} />
        </li>
      ))}
    </ul>
  );
}
