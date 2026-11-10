import { useUpdateDiscoverDay } from "@ngriffin_uk/polychat-library-react";
import {
  updateDiscoverDayProfileSchema,
  type DiscoverDayMode,
  type DiscoverDayProfile,
  type DiscoverPlace,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage, parseCommaSeparatedList } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

function createDiscoverDayDraft(profile: DiscoverDayProfile, audioEnabled: boolean) {
  return {
    ...profile,
    audio: audioEnabled
      ? profile.audio
      : {
          morning: { ...profile.audio.morning, enabled: false },
          evening: { ...profile.audio.evening, enabled: false },
        },
  };
}

export function useDiscoverDayForm(
  profile: DiscoverDayProfile,
  onSaved: () => void,
  audioEnabled: boolean,
) {
  const [draft, setDraft] = useState(() => createDiscoverDayDraft(profile, audioEnabled));
  const [topicsText, setTopicsText] = useState(profile.topics.join(", "));
  const [mutedText, setMutedText] = useState(profile.mutedTopics.join(", "));
  const [origin, setOrigin] = useState<DiscoverPlace | null>(profile.commute?.origin ?? null);
  const [destination, setDestination] = useState<DiscoverPlace | null>(
    profile.commute?.destination ?? null,
  );
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideMode, setOverrideMode] = useState<DiscoverDayMode>("remote");
  const [removeOverride, setRemoveOverride] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateDiscoverDay();
  const save = async () => {
    if (Boolean(origin) !== Boolean(destination)) {
      setError("Choose both commute stops, or remove the saved stop.");

      return;
    }

    const parsed = updateDiscoverDayProfileSchema.safeParse({
      expectedRevision: draft.revision,
      onboarded: true,
      timezone: draft.timezone,
      week: draft.week,
      moments: draft.moments,
      weatherLocation: draft.weatherLocation,
      lineStatus: draft.lineStatus,
      commute:
        origin && destination
          ? {
              provider: "tfl",
              origin,
              destination,
              alertDelayMinutes: draft.commute?.alertDelayMinutes ?? 15,
            }
          : null,
      topics: parseCommaSeparatedList(topicsText),
      mutedTopics: parseCommaSeparatedList(mutedText),
      notifications: draft.notifications,
      audio: draft.audio,
      override: overrideDate ? { date: overrideDate, mode: overrideMode } : undefined,
      removeOverride,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your day preferences");

      return;
    }

    try {
      setError(null);
      await update.mutateAsync(parsed.data);
      onSaved();
    } catch (failure) {
      setError(getErrorMessage(failure, "Your preferences could not be saved"));
    }
  };

  return {
    draft,
    setDraft,
    overrideDate,
    setOverrideDate,
    overrideMode,
    setOverrideMode,
    removeOverride,
    setRemoveOverride,
    error,
    isSaving: update.isPending,
    save,
    origin,
    setOrigin,
    destination,
    setDestination,
    topicsText,
    setTopicsText,
    mutedText,
    setMutedText,
    reload: () => {
      setDraft(createDiscoverDayDraft(profile, audioEnabled));
      setOverrideDate("");
      setRemoveOverride(undefined);
      setError(null);
      setOrigin(profile.commute?.origin ?? null);
      setDestination(profile.commute?.destination ?? null);
      setTopicsText(profile.topics.join(", "));
      setMutedText(profile.mutedTopics.join(", "));
    },
  };
}

export type DiscoverDayForm = ReturnType<typeof useDiscoverDayForm>;
