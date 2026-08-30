import { useEffect, useRef, useState } from "react";

import { derivePetPresence, PET_CHEER_WINDOW_MS, type PetPresence } from "~/lib/pet/clip";
import { useStreamActivityStore } from "~/state/stores/streamActivityStore";

const TICK_MS = 1000;

export function usePetPresence(): PetPresence {
  const activity = useStreamActivityStore((state) => state.activity);
  const lastCompletedAt = useRef<number | null>(null);
  const lastActiveAt = useRef<number | null>(null);
  const wasActive = useRef(false);

  const [presence, setPresence] = useState<PetPresence>(() =>
    derivePetPresence({
      activity: null,
      isRecovering: false,
      lastCompletedAt: null,
      lastActiveAt: null,
      now: Date.now(),
    }),
  );

  useEffect(() => {
    const isActive = activity !== null;

    if (isActive) {
      lastActiveAt.current = Date.now();
    } else if (wasActive.current) {
      lastCompletedAt.current = Date.now();
    }

    wasActive.current = isActive;
  }, [activity]);

  useEffect(() => {
    function update() {
      setPresence(
        derivePetPresence({
          activity,
          isRecovering: false,
          lastCompletedAt: lastCompletedAt.current,
          lastActiveAt: lastActiveAt.current,
          now: Date.now(),
        }),
      );
    }

    update();

    const interval = window.setInterval(update, activity ? TICK_MS : PET_CHEER_WINDOW_MS);

    return () => window.clearInterval(interval);
  }, [activity]);

  return presence;
}
