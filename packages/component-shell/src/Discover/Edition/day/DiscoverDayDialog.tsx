import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  FormInput,
  FormSelect,
  FormDisclosure,
} from "@ngriffin_uk/polychat-component-ui";
import type { DiscoverDayProfile } from "@ngriffin_uk/polychat-schemas";
import { describeZonedInstant, readLocalTimeZone } from "@ngriffin_uk/polychat-utility-core";
import { useCurrentTime } from "@ngriffin_uk/polychat-utility-react";

import {
  describeDiscoverAlerts,
  describeDiscoverAudio,
  describeDiscoverLines,
  describeDiscoverWeek,
} from "./discover-day-summary.js";
import { DiscoverAudioField } from "./DiscoverAudioField.js";
import { DiscoverLinesField } from "./DiscoverLinesField.js";
import { DiscoverNotificationField } from "./DiscoverNotificationField.js";
import { DiscoverPlacesField } from "./DiscoverPlacesField.js";
import { DiscoverPolySetup } from "./DiscoverPolySetup.js";
import { DiscoverWeekField, DISCOVER_DAY_MODE_OPTIONS } from "./DiscoverWeekField.js";
import { useDiscoverDayForm } from "./useDiscoverDayForm.js";

export function DiscoverDayDialog({
  profile,
  onClose,
  audioEnabled,
}: {
  profile: DiscoverDayProfile;
  onClose: () => void;
  audioEnabled: boolean;
}) {
  const form = useDiscoverDayForm(profile, onClose, audioEnabled);
  const now = useCurrentTime();
  const { draft, setDraft } = form;
  const moments = [
    { key: "morning", label: "Morning" },
    { key: "lunch", label: "Lunch" },
    { key: "afternoon", label: "Afternoon" },
    { key: "evening", label: "Evening" },
  ] as const;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="flex max-h-[88dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 px-6 pt-6 pr-14 pb-4">
          <DialogTitle>Your day</DialogTitle>
          <DialogDescription>
            Discover follows your routine. Review it here or ask Poly to change it.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-6">
          <DiscoverPolySetup configured={profile.onboarded} onOpen={onClose} />
          <div className="space-y-2">
            <p className="pb-1 text-xs text-muted-foreground">Or edit a part of your day</p>
            <FormDisclosure title="Your usual week" summary={describeDiscoverWeek(draft)}>
              <DiscoverWeekField
                week={draft.week}
                onChange={(week) => setDraft({ ...draft, week })}
              />
              <div className="flex items-end gap-3">
                <FormInput
                  label="Timezone"
                  value={draft.timezone}
                  onChange={(event) => setDraft({ ...draft, timezone: event.target.value })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setDraft({ ...draft, timezone: readLocalTimeZone() ?? draft.timezone })
                  }
                >
                  Use this device
                </Button>
              </div>
            </FormDisclosure>
            <FormDisclosure
              title="Catch-up times"
              summary={`${draft.moments.morning} · ${draft.moments.lunch} · ${draft.moments.afternoon} · ${draft.moments.evening}`}
            >
              <p className="text-xs text-muted-foreground">
                Useful stories and priorities around these times. Discover also checks for changes
                between catch-ups.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {moments.map((moment) => (
                  <FormInput
                    key={moment.key}
                    label={moment.label}
                    type="time"
                    value={draft.moments[moment.key]}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        moments: { ...draft.moments, [moment.key]: event.target.value },
                      })
                    }
                  />
                ))}
              </div>
            </FormDisclosure>
            <FormDisclosure
              title="Interests"
              summary={form.topicsText || "From your chats and follows"}
            >
              <FormInput
                label="Keep up with"
                description="Separate topics with commas."
                value={form.topicsText}
                onChange={(event) => form.setTopicsText(event.target.value)}
                placeholder="AI, photography, local events"
              />
              <FormInput
                label="Leave out"
                description="Topics you do not want in Discover."
                value={form.mutedText}
                onChange={(event) => form.setMutedText(event.target.value)}
              />
            </FormDisclosure>
            <FormDisclosure
              title="Weather and travel"
              summary={draft.weatherLocation?.label ?? (draft.commute ? "Public transport" : "Off")}
            >
              <DiscoverPlacesField
                profile={draft}
                onChange={setDraft}
                origin={form.origin}
                destination={form.destination}
                onOrigin={form.setOrigin}
                onDestination={form.setDestination}
              />
            </FormDisclosure>
            <FormDisclosure title="Line status" summary={describeDiscoverLines(draft)}>
              <DiscoverLinesField
                value={draft.lineStatus}
                onChange={(lineStatus) => setDraft({ ...draft, lineStatus })}
              />
            </FormDisclosure>
            <FormDisclosure title="Podcasts" summary={describeDiscoverAudio(draft)}>
              <DiscoverAudioField
                audio={draft.audio}
                onChange={(audio) => setDraft({ ...draft, audio })}
              />
            </FormDisclosure>
            <FormDisclosure title="Notifications" summary={describeDiscoverAlerts(draft)}>
              <DiscoverNotificationField
                value={draft.notifications}
                onChange={(notifications) => setDraft({ ...draft, notifications })}
              />
            </FormDisclosure>
            <FormDisclosure
              title="Change a single day"
              summary={
                draft.overrides.length ? `${draft.overrides.length} planned` : "Use your usual week"
              }
            >
              <div className="grid grid-cols-2 items-end gap-3">
                <FormInput
                  label="Date (optional)"
                  type="date"
                  value={form.overrideDate}
                  min={describeZonedInstant(now, profile.timezone).date}
                  onChange={(event) => form.setOverrideDate(event.target.value)}
                />
                <FormSelect
                  label="For this date only"
                  options={DISCOVER_DAY_MODE_OPTIONS}
                  value={form.overrideMode}
                  onValueChange={form.setOverrideMode}
                />
              </div>
              {draft.overrides.map((override) => (
                <div
                  key={override.date}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span
                    className={
                      form.removeOverride === override.date ? "line-through opacity-50" : undefined
                    }
                  >
                    {override.date} ·{" "}
                    {
                      DISCOVER_DAY_MODE_OPTIONS.find((option) => option.value === override.mode)
                        ?.label
                    }
                  </span>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() =>
                      form.setRemoveOverride(
                        form.removeOverride === override.date ? undefined : override.date,
                      )
                    }
                  >
                    {form.removeOverride === override.date ? "Undo" : "Remove"}
                  </Button>
                </div>
              ))}
            </FormDisclosure>
          </div>
        </div>
        <div className="shrink-0 space-y-3 border-t border-border px-6 py-4">
          {form.error ? (
            <div role="alert" className="flex flex-col gap-2 text-sm text-failure">
              <p>{form.error}</p>
              <Button variant="ghost" size="sm" className="self-start" onClick={form.reload}>
                Reload saved preferences
              </Button>
            </div>
          ) : null}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button isLoading={form.isSaving} onClick={() => void form.save()}>
              Save changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
