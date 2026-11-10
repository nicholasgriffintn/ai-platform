import { FormCheckbox, Switch } from "@ngriffin_uk/polychat-component-ui";
import {
  DISCOVER_TRANSIT_LINES,
  type DiscoverLineStatusPreferences,
} from "@ngriffin_uk/polychat-schemas";

const MAX_LINES = 12;

export function DiscoverLinesField({
  value,
  onChange,
}: {
  value: DiscoverLineStatusPreferences;
  onChange: (value: DiscoverLineStatusPreferences) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="sr-only">Line status</legend>
      <Switch
        label="Show line status"
        checked={value.enabled}
        onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
      />
      <Switch
        label="Include lines near my phone"
        checked={value.nearby}
        disabled={!value.enabled}
        onChange={(event) => onChange({ ...value, nearby: event.target.checked })}
      />
      <p className="text-xs leading-relaxed text-muted-foreground">
        Pick the lines you use. Nearby lines need location to be turned on in the Polychat iPhone
        app.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {DISCOVER_TRANSIT_LINES.map((line) => {
          const checked = value.lines.includes(line.id);

          return (
            <FormCheckbox
              key={line.id}
              label={line.name}
              labelPosition="right"
              checked={checked}
              disabled={!value.enabled || (!checked && value.lines.length >= MAX_LINES)}
              onCheckedChange={(next) =>
                onChange({
                  ...value,
                  lines: next
                    ? [...value.lines, line.id]
                    : value.lines.filter((id) => id !== line.id),
                })
              }
            />
          );
        })}
      </div>
    </fieldset>
  );
}
