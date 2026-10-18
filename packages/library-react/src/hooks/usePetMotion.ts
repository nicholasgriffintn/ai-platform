import type { PetStateName } from "@ngriffin_uk/polychat-schemas";
import { useEffect, useState } from "react";

import {
  petDwellRemaining,
  settlePetMotion,
  startPetMotion,
  stepPetMotion,
  type PetMotion,
} from "../lib/pet/machine.js";

export function usePetMotion(target: PetStateName, minimumMs?: number): PetStateName {
  const [motion, setMotion] = useState<PetMotion>(() => startPetMotion(target, Date.now()));
  const [previousTarget, setPreviousTarget] = useState(target);

  if (previousTarget !== target) {
    setPreviousTarget(target);
    setMotion((current) => stepPetMotion(current, target, Date.now(), minimumMs));
  }

  useEffect(() => {
    if (motion.queued === null) {
      return undefined;
    }

    const timeout = window.setTimeout(
      () => setMotion((current) => settlePetMotion(current, Date.now(), minimumMs)),
      petDwellRemaining(motion, Date.now(), minimumMs),
    );

    return () => window.clearTimeout(timeout);
  }, [motion, minimumMs]);

  return motion.shown;
}
