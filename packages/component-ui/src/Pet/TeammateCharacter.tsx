import { usePetAnimationEnabled, useTeammatePresence } from "@ngriffin_uk/polychat-library-react";
import {
  findPetSheetLayout,
  resolvePetClipIn,
  resolvePetPreset,
} from "@ngriffin_uk/polychat-schemas";
import { useMediaQuery } from "@ngriffin_uk/polychat-utility-react";

import { PetSprite } from "../PetSprite";
import { PetAccent } from "./PetAccent";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export interface TeammateCharacterProps {
  characterId: string;
  teammateId?: string | null;
  name: string;
  size?: number;
  className?: string;
}

export function TeammateCharacter({
  characterId,
  teammateId,
  name,
  size = 40,
  className,
}: TeammateCharacterProps) {
  const preset = resolvePetPreset(characterId);
  const layout = findPetSheetLayout(preset.layoutId);
  const presence = useTeammatePresence(teammateId);
  const animationEnabled = usePetAnimationEnabled();
  const prefersReducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const shouldAnimate = animationEnabled && !prefersReducedMotion;

  return (
    <span className="relative inline-flex" title={`${name}: ${presence.status}`}>
      <PetSprite
        sheetUrl={preset.sheetUrl}
        layout={layout}
        clip={resolvePetClipIn(layout, shouldAnimate ? presence.state : "idle")}
        label={`${name}. ${presence.status}`}
        size={size}
        paused={!shouldAnimate}
        className={className}
      />
      <PetAccent accent={presence.accent} size={size} />
    </span>
  );
}
