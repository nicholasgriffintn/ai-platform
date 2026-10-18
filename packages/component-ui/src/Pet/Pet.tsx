import {
  type ActivePet,
  PET_SETTINGS_PATH,
  PET_SWAP_FADE_MS,
  useActivePet,
  useCharacterPresence,
  usePetAnimationEnabled,
  usePetFollowEnabled,
  usePetGaze,
  usePetMotion,
  usePetStore,
  usePetSwapTransition,
  usePetTravel,
} from "@ngriffin_uk/polychat-library-react";
import {
  PET_IDLE_FLOURISH_CLIPS,
  type ModelConfigItem,
  type PetConversationState,
  type PetStateName,
  resolvePet,
  resolvePetClipIn,
  resolvePetLook,
} from "@ngriffin_uk/polychat-schemas";
import { useMediaQuery } from "@ngriffin_uk/polychat-utility-react";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Link } from "../Link";
import { PetBubble } from "../PetBubble";
import { PetSprite } from "../PetSprite";
import { cn } from "../utils";
import { PetAccent } from "./PetAccent";

const FLOURISH_MIN_MS = 7000;
const FLOURISH_SPREAD_MS = 9000;
const GLANCE_TILT_DEGREES = 8;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const GAZE_STATES: ReadonlySet<PetStateName> = new Set(["idle", "wait", "review", "listen"]);

export interface PetProps {
  size?: number;
  facing?: "left" | "right";
  placement?: "left" | "top";
  className?: string;
  model?: Pick<ModelConfigItem, "family" | "provider">;
  modelReady?: boolean;
  conversationState?: PetConversationState;
  conversationId?: string | null;
  presetSlug?: string;
  href?: string | null;
  onActivate?: () => void;
  activateLabel?: string;
  showNudges?: boolean;
  label?: string;
}

interface GlanceStyle extends CSSProperties {
  "--polychat-pet-glance": string;
}

function glanceTilt(angle: number): number {
  const vertical = Math.cos((angle * Math.PI) / 180);

  return -vertical * GLANCE_TILT_DEGREES;
}

export function Pet({
  size = 96,
  facing = "right",
  placement = "left",
  className,
  model,
  modelReady = true,
  conversationState,
  conversationId,
  presetSlug,
  href = PET_SETTINGS_PATH,
  onActivate,
  activateLabel,
  showNudges = true,
  label,
}: PetProps) {
  const selectedPet = useActivePet(model, modelReady, conversationState);
  const presetPet = useMemo<ActivePet | null>(
    () =>
      presetSlug
        ? { ...resolvePet({ pet_source: "preset", pet_id: presetSlug }), isReady: true }
        : null,
    [presetSlug],
  );
  const activePet = presetPet ?? selectedPet;
  const presence = useCharacterPresence({ conversationId });
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
  const shown = usePetMotion(presence.state);
  const frameRef = useRef<HTMLSpanElement | null>(null);
  const gaze = usePetGaze(frameRef, shouldAnimate && GAZE_STATES.has(shown));

  const nudge = usePetStore((state) => (showNudges ? (state.nudges[0] ?? null) : null));
  const dismissNudge = usePetStore((state) => state.dismissNudge);

  const [flourish, setFlourish] = useState<PetStateName | null>(null);
  const [isHinting, setIsHinting] = useState(false);
  const [previousShown, setPreviousShown] = useState(shown);

  if (previousShown !== shown) {
    setPreviousShown(shown);

    if (shown !== "idle" && flourish !== null) {
      setFlourish(null);
    }
  }

  useEffect(() => {
    if (!pet.isReady || !shouldAnimate || shown !== "idle" || flourish !== null || gaze) {
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
  }, [shouldAnimate, pet.isReady, shown, flourish, gaze]);

  const handleClipEnd = useCallback(() => setFlourish(null), []);

  const clip = resolvePetClipIn(
    pet.layout,
    shouldAnimate ? (isTravelling ? "flit" : (flourish ?? shown)) : "idle",
  );
  const look = gaze && !isTravelling && !flourish ? resolvePetLook(pet.layout, gaze.angle) : null;
  const glance = gaze && !look && !isTravelling ? glanceTilt(gaze.angle) : 0;
  const faces = gaze && !look ? gaze.facing : facing;
  const glanceStyle: GlanceStyle = { "--polychat-pet-glance": `${glance}deg` };
  const showHint = nudge === null && isHinting;
  const accessibleName = label ?? `${pet.name}. ${presence.status}`;

  if (!activePet.isReady || !pet.isReady) {
    return null;
  }

  const sprite = (
    <span ref={frameRef} className="polychat-pet-glance relative inline-flex" style={glanceStyle}>
      <PetSprite
        sheetUrl={pet.sheetUrl}
        layout={pet.layout}
        clip={clip}
        frame={look}
        label=""
        size={size}
        facing={faces}
        paused={!shouldAnimate}
        className={cn("polychat-pet-perched", isTravelling && "polychat-pet-arriving", className)}
        onClipEnd={handleClipEnd}
      />
      <PetAccent accent={presence.accent} size={size} />
    </span>
  );

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

      {onActivate ? (
        <button
          type="button"
          className="inline-flex cursor-pointer rounded-md leading-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label={activateLabel ? `${accessibleName}. ${activateLabel}` : accessibleName}
          onClick={onActivate}
          onFocus={() => setIsHinting(true)}
          onBlur={() => setIsHinting(false)}
        >
          {sprite}
        </button>
      ) : href ? (
        <Link
          href={href}
          className="inline-flex cursor-pointer rounded-md leading-none"
          aria-label={`${accessibleName}. Open pet settings`}
          onFocus={() => setIsHinting(true)}
          onBlur={() => setIsHinting(false)}
        >
          {sprite}
        </Link>
      ) : (
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        <span role="img" aria-label={accessibleName} className="inline-flex leading-none">
          {sprite}
        </span>
      )}
    </span>
  );
}
