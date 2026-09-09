import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";

import { useAuthStatus } from "../hooks/useAuth.js";

export const PET_TRAVEL_MS = 900;

export function usePetFollowEnabled(): boolean {
  const { userSettings } = useAuthStatus();

  return Boolean(userSettings?.pet_travel_enabled);
}

export function usePetAnimationEnabled(): boolean {
  const { userSettings } = useAuthStatus();

  return Boolean(userSettings?.pet_animation_enabled);
}

export function usePetTravel(enabled: boolean): boolean {
  const location = useLocation();
  const [isTravelling, setIsTravelling] = useState(false);
  const previousPath = useRef(location.pathname);

  useEffect(() => {
    if (previousPath.current === location.pathname) {
      return undefined;
    }

    previousPath.current = location.pathname;

    if (!enabled) {
      return undefined;
    }

    setIsTravelling(true);

    const timeout = window.setTimeout(() => setIsTravelling(false), PET_TRAVEL_MS);

    return () => window.clearTimeout(timeout);
  }, [enabled, location.pathname]);

  return isTravelling;
}
