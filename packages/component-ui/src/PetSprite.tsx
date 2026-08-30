import type { CSSProperties } from "react";

import { cn } from "./utils";

export interface PetSpriteLayout {
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
}

export interface PetSpriteClip {
  row: number;
  frames: number;
  fps: number;
  loop: boolean;
}

export interface PetSpriteProps {
  sheetUrl: string;
  layout: PetSpriteLayout;
  clip: PetSpriteClip;
  label: string;
  size?: number;
  facing?: "left" | "right";
  paused?: boolean;
  className?: string;
  onClipEnd?: () => void;
}

interface PetSpriteStyle extends CSSProperties {
  "--polychat-pet-width": string;
  "--polychat-pet-height": string;
  "--polychat-pet-sheet-width": string;
  "--polychat-pet-sheet-height": string;
  "--polychat-pet-row": number;
  "--polychat-pet-frames": number;
  "--polychat-pet-duration": string;
  "--polychat-pet-iterations": string;
  "--polychat-pet-facing": number;
}

export function PetSprite({
  sheetUrl,
  layout,
  clip,
  label,
  size = 96,
  facing = "right",
  paused = false,
  className,
  onClipEnd,
}: PetSpriteProps) {
  const scale = size / layout.frameWidth;
  const height = layout.frameHeight * scale;
  const duration = clip.frames / Math.max(clip.fps, 1);

  const style: PetSpriteStyle = {
    "--polychat-pet-width": `${size}px`,
    "--polychat-pet-height": `${height}px`,
    "--polychat-pet-sheet-width": `${layout.columns * size}px`,
    "--polychat-pet-sheet-height": `${layout.rows * height}px`,
    "--polychat-pet-row": clip.row,
    "--polychat-pet-frames": clip.frames,
    "--polychat-pet-duration": `${duration.toFixed(3)}s`,
    "--polychat-pet-iterations": clip.loop ? "infinite" : "1",
    "--polychat-pet-facing": facing === "left" ? -1 : 1,
    animationPlayState: paused ? "paused" : undefined,
    backgroundImage: `url("${sheetUrl}")`,
  };

  return (
    <span
      key={`${sheetUrl}:${clip.row}`}
      className={cn("polychat-pet", className)}
      style={style}
      role="img"
      aria-label={label}
      onAnimationEnd={clip.loop ? undefined : onClipEnd}
    />
  );
}
