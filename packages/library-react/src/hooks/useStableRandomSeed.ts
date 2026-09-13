import { useId } from "react";

function hashToUnitInterval(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 0x100000000;
}

export function useStableRandomSeed(): number {
  return hashToUnitInterval(useId());
}
