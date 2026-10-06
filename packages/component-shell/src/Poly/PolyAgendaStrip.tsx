import { cn } from "@ngriffin_uk/polychat-component-ui";
import { usePolyAgenda } from "@ngriffin_uk/polychat-library-react";
import type { PolyAgendaItem } from "@ngriffin_uk/polychat-schemas";

const VISIBLE_ITEMS = 3;

const TONE_CLASS_NAMES = {
  "human-action": "text-human-action",
  "active-work": "text-active-work",
} as const;

function AgendaGroup({
  label,
  items,
  tone,
}: {
  label: string;
  items: readonly PolyAgendaItem[];
  tone: keyof typeof TONE_CLASS_NAMES;
}) {
  if (items.length === 0) {
    return null;
  }

  const hidden = items.length - VISIBLE_ITEMS;

  return (
    <section aria-label={label} className="min-w-0 flex-1">
      <h3 className={cn("polychat-eyebrow", TONE_CLASS_NAMES[tone])}>{label}</h3>
      <ul className="mt-1 space-y-0.5">
        {items.slice(0, VISIBLE_ITEMS).map((item) => (
          <li key={`${item.kind}:${item.id}`} className="truncate text-xs text-foreground">
            {item.title}
          </li>
        ))}
        {hidden > 0 ? <li className="text-xs text-muted-foreground">and {hidden} more</li> : null}
      </ul>
    </section>
  );
}

export function PolyAgendaStrip() {
  const agenda = usePolyAgenda(true);

  if (!agenda.data) {
    return null;
  }

  const { needs_you: needsYou, working_on: workingOn } = agenda.data;

  if (needsYou.length === 0 && workingOn.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-4 border-b border-border bg-surface-elevated px-4 py-2">
      <AgendaGroup label="Needs you" items={needsYou} tone="human-action" />
      <AgendaGroup label="Working on" items={workingOn} tone="active-work" />
    </div>
  );
}
