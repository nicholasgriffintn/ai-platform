import { Button, cn, FormInput, Switch } from "@ngriffin_uk/polychat-component-ui";
import type { LeadRoutine, LeadRoutineKind, LeadRoutines } from "@ngriffin_uk/polychat-schemas";
import { SHORT_WEEKDAY_LABELS } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

const ROUTINE_COPY: Record<LeadRoutineKind, { title: string; description: string }> = {
  dailyBrief: {
    title: "Daily brief",
    description:
      "The lead writes what moved, what is blocked and what needs you. It lands in Inbox when it is done.",
  },
  initiativeReview: {
    title: "Initiative review",
    description:
      "The lead checks each initiative against its projects' tasks, fixes what it can and summarises the rest.",
  },
};

function RoutineFields({
  kind,
  routine,
  disabled,
  onChange,
}: {
  kind: LeadRoutineKind;
  routine: LeadRoutine;
  disabled: boolean;
  onChange: (routine: LeadRoutine) => void;
}) {
  const copy = ROUTINE_COPY[kind];

  return (
    <div className="space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <Switch
        label={copy.title}
        description={copy.description}
        checked={routine.enabled}
        disabled={disabled}
        onChange={(event) => onChange({ ...routine, enabled: event.target.checked })}
      />
      {routine.enabled ? (
        <div className="space-y-3 pl-11">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormInput
              label="Time"
              type="time"
              value={routine.time}
              disabled={disabled}
              onChange={(event) => onChange({ ...routine, time: event.target.value })}
            />
            <FormInput
              label="Time zone"
              value={routine.timeZone}
              disabled={disabled}
              onChange={(event) => onChange({ ...routine, timeZone: event.target.value })}
            />
          </div>
          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-1 text-sm font-medium">Days</legend>
            {SHORT_WEEKDAY_LABELS.map((day, index) => {
              const active = routine.days.includes(index);

              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={active}
                  disabled={disabled || (active && routine.days.length === 1)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    active
                      ? "border-active-work bg-active-work/10 text-active-work"
                      : "border-border text-muted-foreground hover:border-border-strong",
                  )}
                  onClick={() =>
                    onChange({
                      ...routine,
                      days: active
                        ? routine.days.filter((candidate) => candidate !== index)
                        : [...routine.days, index].sort((left, right) => left - right),
                    })
                  }
                >
                  {day}
                </button>
              );
            })}
          </fieldset>
        </div>
      ) : null}
    </div>
  );
}

export function LeadRoutinesForm({
  routines,
  canManage,
  isSaving,
  onSave,
}: {
  routines: LeadRoutines;
  canManage: boolean;
  isSaving: boolean;
  onSave: (routines: LeadRoutines) => void;
}) {
  const [draft, setDraft] = useState(routines);
  const dirty = JSON.stringify(draft) !== JSON.stringify(routines);

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <RoutineFields
        kind="dailyBrief"
        routine={draft.dailyBrief}
        disabled={!canManage}
        onChange={(dailyBrief) => setDraft({ ...draft, dailyBrief })}
      />
      <RoutineFields
        kind="initiativeReview"
        routine={draft.initiativeReview}
        disabled={!canManage}
        onChange={(initiativeReview) => setDraft({ ...draft, initiativeReview })}
      />
      {canManage && dirty ? (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" disabled={isSaving} onClick={() => setDraft(routines)}>
            Discard
          </Button>
          <Button size="sm" variant="primary" disabled={isSaving} onClick={() => onSave(draft)}>
            Save routines
          </Button>
        </div>
      ) : null}
    </div>
  );
}
