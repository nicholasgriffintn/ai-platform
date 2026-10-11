import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import { useDisagreeWithPolyHandoff, usePolyAgenda } from "@ngriffin_uk/polychat-library-react";
import type { PolyAgendaItem, PolyHandoffJudgement } from "@ngriffin_uk/polychat-schemas";
import { formatProbabilityPercent, getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { toast } from "sonner";

const VISIBLE_ITEMS = 3;

const TONE_CLASS_NAMES = {
  "human-action": "text-human-action",
  "active-work": "text-active-work",
  muted: "text-muted-foreground",
} as const;

function describeJudgement(judgement: PolyHandoffJudgement): string {
  const weighed = judgement.alternatives
    .map(
      (alternative) =>
        `${alternative.option} (${formatProbabilityPercent(alternative.probability)})`,
    )
    .join(", ");

  return `Judged ${judgement.chosen} (${formatProbabilityPercent(judgement.confidence)})${
    weighed ? ` over ${weighed}` : ""
  }`;
}

function AgendaGroup({
  label,
  items,
  tone,
  onDisagree,
  disagreeingId,
}: {
  label: string;
  items: readonly PolyAgendaItem[];
  tone: keyof typeof TONE_CLASS_NAMES;
  onDisagree?: (item: PolyAgendaItem) => void;
  disagreeingId?: string;
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
          <li
            key={`${item.kind}:${item.id}`}
            className="flex min-w-0 items-center gap-2 text-xs text-foreground"
          >
            <span className="min-w-0 flex-1 truncate">
              {item.title}
              {item.judgement ? (
                <span className="text-muted-foreground">
                  {" "}
                  · {describeJudgement(item.judgement)}
                </span>
              ) : null}
            </span>
            {onDisagree ? (
              <Button
                variant="ghost"
                size="xs"
                className="shrink-0"
                isLoading={disagreeingId === item.id}
                onClick={() => onDisagree(item)}
              >
                Tell me next time
              </Button>
            ) : null}
          </li>
        ))}
        {hidden > 0 ? <li className="text-xs text-muted-foreground">and {hidden} more</li> : null}
      </ul>
    </section>
  );
}

export function PolyAgendaStrip() {
  const agenda = usePolyAgenda(true);
  const disagree = useDisagreeWithPolyHandoff();

  if (!agenda.data) {
    return null;
  }

  const { needs_you: needsYou, working_on: workingOn, noted } = agenda.data;

  if (needsYou.length === 0 && workingOn.length === 0 && noted.length === 0) {
    return null;
  }

  const disagreeWith = (item: PolyAgendaItem) => {
    disagree.mutate(item.id, {
      onSuccess: () => toast.success(`Poly will tell you when “${item.title}” has a result`),
      onError: (error) => toast.error(getErrorMessage(error, "Poly could not take that on board")),
    });
  };

  return (
    <div className="flex flex-wrap gap-4 border-b border-border bg-surface-elevated px-4 py-2">
      <AgendaGroup label="Needs you" items={needsYou} tone="human-action" />
      <AgendaGroup label="Working on" items={workingOn} tone="active-work" />
      <AgendaGroup
        label="Noted quietly"
        items={noted}
        tone="muted"
        onDisagree={disagreeWith}
        disagreeingId={disagree.isPending ? disagree.variables : undefined}
      />
    </div>
  );
}
