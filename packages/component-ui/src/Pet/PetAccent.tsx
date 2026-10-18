import type { PetAccent as PetAccentName } from "@ngriffin_uk/polychat-library-react";
import type { ReactNode } from "react";

const GLYPHS: Record<PetAccentName, ReactNode> = {
  alert: (
    <>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <rect x="10.75" y="5.5" width="2.5" height="8" rx="1.25" fill="var(--polychat-canvas)" />
      <circle cx="12" cy="17" r="1.5" fill="var(--polychat-canvas)" />
    </>
  ),
  drop: <path d="M12 3c4 6 6 9 6 12a6 6 0 0 1-12 0c0-3 2-6 6-12z" fill="currentColor" />,
  sleep: (
    <text
      x="4"
      y="18"
      fontSize="15"
      fontWeight="600"
      fill="currentColor"
      fontFamily="var(--polychat-font-mono, monospace)"
    >
      z
    </text>
  ),
  rings: (
    <>
      <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  spark: <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" fill="currentColor" />,
};

export interface PetAccentProps {
  accent: PetAccentName | null;
  size: number;
}

export function PetAccent({ accent, size }: PetAccentProps) {
  if (!accent) {
    return null;
  }

  const glyphSize = Math.max(10, Math.round(size * 0.28));

  return (
    <svg
      className="polychat-pet-accent"
      data-accent={accent}
      width={glyphSize}
      height={glyphSize}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {GLYPHS[accent]}
    </svg>
  );
}
