import { getExperienceCapabilityId, useSetAppEnabled } from "@ngriffin_uk/polychat-library-react";
import type { ProjectExperienceDefinition } from "@ngriffin_uk/polychat-schemas";
import { useMemo, useState } from "react";

export interface PersonalAppToggle {
  enabled: boolean;
  isPending: boolean;
  onToggle: (enabled: boolean) => void;
}

export function useAppDetails(
  experiences: readonly ProjectExperienceDefinition[],
  isPersonal: boolean,
) {
  const setEnabled = useSetAppEnabled();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const byCapabilityId = useMemo(
    () =>
      new Map(experiences.map((experience) => [getExperienceCapabilityId(experience), experience])),
    [experiences],
  );

  const toggleFor = (experience: ProjectExperienceDefinition): PersonalAppToggle | undefined =>
    isPersonal
      ? {
          enabled: experience.enabled !== false,
          isPending: setEnabled.isPending && setEnabled.variables?.appId === experience.id,
          onToggle: (enabled) => setEnabled.mutate({ appId: experience.id, enabled }),
        }
      : undefined;

  return {
    byCapabilityId,
    error: setEnabled.error,
    selected: selectedId ? (byCapabilityId.get(selectedId) ?? null) : null,
    select: setSelectedId,
    close: () => setSelectedId(null),
    toggleFor,
  };
}
