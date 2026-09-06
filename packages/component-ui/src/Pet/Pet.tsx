import {
  usePetPresence,
  type ActivePet,
  useActivePet,
  PET_SWAP_FADE_MS,
  usePetSwapTransition,
  usePetAnimationEnabled,
  usePetFollowEnabled,
  usePetTravel,
  usePetStore,
} from "@ngriffin_uk/polychat-library-react";
import {
  PET_IDLE_FLOURISH_CLIPS,
  type ModelConfigItem,
  type PetClipName,
  resolvePet,
  resolvePetClipIn,
} from "@ngriffin_uk/polychat-schemas";
import { useMediaQuery } from "@ngriffin_uk/polychat-utility-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Link } from "../Link";
import { PetBubble } from "../PetBubble";
import { PetSprite } from "../PetSprite";
import { cn } from "../utils";

const FLOURISH_MIN_MS = 7000;
const FLOURISH_SPREAD_MS = 9000;
const PET_SETTINGS_HREF = "/profile?tab=pets";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export interface PetProps {
  size?: number;
  facing?: "left" | "right";
  placement?: "left" | "top";
  className?: string;
  model?: Pick<ModelConfigItem, "family" | "provider">;
  modelReady?: boolean;
  presetSlug?: string;
}

export function Pet({
  size = 96,
  facing = "right",
  placement = "left",
  className,
  model,
  modelReady = true,
  presetSlug,
}: PetProps) {
  const selectedPet = useActivePet(model, modelReady);
  const presetPet = useMemo<ActivePet | null>(
    () =>
      presetSlug
        ? { ...resolvePet({ pet_source: "preset", pet_id: presetSlug }), isReady: true }
        : null,
    [presetSlug],
  );
  const activePet = presetPet ?? selectedPet;
  const presence = usePetPresence();
  const follows = usePetFollowEnabled();
  const animationEnabled = usePetAnimationEnabled();
  const prefersReducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const { displayed: pet, visible } = usePetSwapTransition(
    activePet,
    `${activePet.source}:${activePet.id}`,
    activePet.isReady,
    !prefersReducedMotion,
  );
  const shouldAnimate = animationEnabled && !prefersReducedMotion;
  const isTravelling = usePetTravel(follows && shouldAnimate);

  const nudge = usePetStore((state) => state.nudges[0] ?? null);
  const dismissNudge = usePetStore((state) => state.dismissNudge);

  const [flourish, setFlourish] = useState<PetClipName | null>(null);
  const [isHinting, setIsHinting] = useState(false);

  useEffect(() => {
    if (!pet.isReady || !shouldAnimate || presence.clip !== "idle" || flourish !== null) {
      return undefined;
    }

    const timeout = window.setTimeout(
      () => {
        const index = Math.floor(Math.random() * PET_IDLE_FLOURISH_CLIPS.length);

        setFlourish(PET_IDLE_FLOURISH_CLIPS[index]);
      },
      FLOURISH_MIN_MS + Math.random() * FLOURISH_SPREAD_MS,
    );

    return () => window.clearTimeout(timeout);
  }, [shouldAnimate, pet.isReady, presence.clip, flourish]);

  useEffect(() => {
    if (presence.clip !== "idle" && flourish !== null) {
      setFlourish(null);
    }
  }, [presence.clip, flourish]);

  const handleClipEnd = useCallback(() => setFlourish(null), []);

  const clip = resolvePetClipIn(
    pet.layout,
    shouldAnimate ? (isTravelling ? "flit" : (flourish ?? presence.clip)) : "idle",
  );
  const showHint = nudge === null && isHinting;

  if (!activePet.isReady || !pet.isReady) {
    return null;
  }

  return (
    <span
      className={cn(
        "relative inline-flex transition-opacity",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      style={{ transitionDuration: `${PET_SWAP_FADE_MS}ms` }}
      onMouseEnter={() => setIsHinting(true)}
      onMouseLeave={() => setIsHinting(false)}
    >
      {nudge ? (
        <PetBubble
          placement={placement}
          actionLabel={nudge.href ? "Take a look" : undefined}
          actionHref={nudge.href ?? undefined}
          onDismiss={() => dismissNudge(nudge.id)}
        >
          {nudge.message}
        </PetBubble>
      ) : null}

      {showHint ? <PetBubble placement={placement}>{presence.status}</PetBubble> : null}

      <Link
        href={PET_SETTINGS_HREF}
        className="inline-flex cursor-pointer rounded-md leading-none"
        aria-label={`${pet.name}. ${presence.status}. Open pet settings`}
        onFocus={() => setIsHinting(true)}
        onBlur={() => setIsHinting(false)}
      >
        <PetSprite
          sheetUrl={pet.sheetUrl}
          layout={pet.layout}
          clip={clip}
          label=""
          size={size}
          facing={facing}
          paused={!shouldAnimate}
          className={cn("polychat-pet-perched", isTravelling && "polychat-pet-arriving", className)}
          onClipEnd={handleClipEnd}
        />
      </Link>
    </span>
  );
}

export function usePetStatus(): string {
  return usePetPresence().status;
}
