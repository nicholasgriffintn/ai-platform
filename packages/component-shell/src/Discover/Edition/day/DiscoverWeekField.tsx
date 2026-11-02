import { Button, FormInput, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import type { DiscoverDayMode, DiscoverDayProfile } from "@ngriffin_uk/polychat-schemas";
import { SHORT_WEEKDAY_LABELS } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

export const DISCOVER_DAY_MODE_OPTIONS: ReadonlyArray<{ value: DiscoverDayMode; label: string }> = [
  { value: "office", label: "In the office" },
  { value: "remote", label: "Working from home" },
  { value: "off", label: "Day off" },
];

export function DiscoverWeekField({
  week,
  onChange,
}: {
  week: DiscoverDayProfile["week"];
  onChange: (week: DiscoverDayProfile["week"]) => void;
}) {
  const [selected, setSelected] = useState(1);
  const day = week.find((value) => value.weekday === selected);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Choose a day to edit its usual routine.</p>
      <div className="grid grid-cols-7 gap-1" aria-label="Day to edit">
        {[1, 2, 3, 4, 5, 6, 0].map((weekday) => {
          const value = week.find((candidate) => candidate.weekday === weekday);

          return (
            <Button
              key={weekday}
              variant={selected === weekday ? "secondary" : "ghost"}
              className="h-auto flex-col gap-1 px-1 py-2"
              aria-pressed={selected === weekday}
              aria-label={`Edit ${SHORT_WEEKDAY_LABELS[weekday]}`}
              onClick={() => setSelected(weekday)}
            >
              <span>{SHORT_WEEKDAY_LABELS[weekday]}</span>
              <span className="text-[10px] font-normal text-muted-foreground">
                {value?.mode === "office" ? "Office" : value?.mode === "remote" ? "Home" : "Off"}
              </span>
            </Button>
          );
        })}
      </div>
      {day ? (
        <DiscoverWorkdayField
          day={day}
          onChange={(updated) =>
            onChange(week.map((value) => (value.weekday === selected ? updated : value)))
          }
        />
      ) : null}
    </div>
  );
}

function DiscoverWorkdayField({
  day,
  onChange,
}: {
  day: DiscoverDayProfile["week"][number];
  onChange: (day: DiscoverDayProfile["week"][number]) => void;
}) {
  return (
    <div className="space-y-3">
      <FormSelect
        label={`${SHORT_WEEKDAY_LABELS[day.weekday]} routine`}
        options={DISCOVER_DAY_MODE_OPTIONS}
        value={day.mode}
        fullWidth
        onValueChange={(mode) => onChange({ ...day, mode })}
      />
      {day.mode !== "off" ? (
        <div className="grid grid-cols-2 gap-3">
          <FormInput
            label="Start work"
            type="time"
            value={day.start}
            onChange={(event) => onChange({ ...day, start: event.target.value })}
          />
          <FormInput
            label="Finish work"
            type="time"
            value={day.end}
            onChange={(event) => onChange({ ...day, end: event.target.value })}
          />
          {day.mode === "office" ? (
            <>
              <FormInput
                label="Leave for work"
                type="time"
                value={day.outbound}
                onChange={(event) => onChange({ ...day, outbound: event.target.value })}
              />
              <FormInput
                label="Leave for home"
                type="time"
                value={day.returning}
                onChange={(event) => onChange({ ...day, returning: event.target.value })}
              />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
