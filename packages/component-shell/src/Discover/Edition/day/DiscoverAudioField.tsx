import { FormInput, Switch } from "@ngriffin_uk/polychat-component-ui";
import type { DiscoverDayProfile } from "@ngriffin_uk/polychat-schemas";

export function DiscoverAudioField({
  audio,
  onChange,
}: {
  audio: DiscoverDayProfile["audio"];
  onChange: (audio: DiscoverDayProfile["audio"]) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="sr-only">Podcasts</legend>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Choose when The Perch is recorded. Your feed keeps updating between podcasts.
      </p>
      {(["morning", "evening"] as const).map((slot) => (
        <div key={slot} className="flex items-end gap-4">
          <Switch
            label={slot === "morning" ? "Morning podcast" : "Evening podcast"}
            checked={audio[slot].enabled}
            onChange={(event) =>
              onChange({ ...audio, [slot]: { ...audio[slot], enabled: event.target.checked } })
            }
          />
          <FormInput
            aria-label={`${slot} podcast time`}
            type="time"
            value={audio[slot].time}
            disabled={!audio[slot].enabled}
            onChange={(event) =>
              onChange({ ...audio, [slot]: { ...audio[slot], time: event.target.value } })
            }
          />
        </div>
      ))}
    </fieldset>
  );
}
