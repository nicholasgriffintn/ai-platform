import type { DiscoverWindDownBed } from "@ngriffin_uk/polychat-schemas";
import { moonLitPath, moonPhase } from "@ngriffin_uk/polychat-utility-core";
import { useId } from "react";

import {
  SCENE_HEIGHT,
  SCENE_WIDTH,
  WIND_DOWN_SCENES,
  scatterSceneDots,
  sceneWavePath,
  type SceneDot,
} from "./wind-down-scene.js";

const SCENE_MOTION = `
@keyframes wd-twinkle { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.95; } }
@keyframes wd-fall { from { transform: translateY(-24px); } to { transform: translateY(${SCENE_HEIGHT + 8}px); } }
@keyframes wd-rise { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(-64px); opacity: 0; } }
@keyframes wd-drift { from { transform: translateX(0); } to { transform: translateX(-${SCENE_WIDTH}px); } }
@keyframes wd-sway { 0%, 100% { transform: translateX(-8px) scaleY(1); opacity: 0.45; } 50% { transform: translateX(8px) scaleY(1.2); opacity: 0.85; } }
@keyframes wd-shimmer { 0%, 100% { opacity: 0.25; } 50% { opacity: 0.7; } }
.wd-scene * { transform-box: fill-box; transform-origin: center; }
.wd-still * { animation-play-state: paused !important; }
@media (prefers-reduced-motion: reduce) { .wd-scene * { animation: none !important; } }
`;

function Stars({ dots }: { dots: readonly SceneDot[] }) {
  return dots.map((dot, index) => (
    <circle
      key={index}
      cx={dot.x}
      cy={dot.y}
      r={dot.size}
      fill="#f8fafc"
      style={{
        animation: `wd-twinkle ${dot.duration}s ease-in-out ${-dot.delay}s infinite`,
      }}
    />
  ));
}

function Moon({ phase, reflect }: { phase: number; reflect: boolean }) {
  return (
    <g>
      <circle cx={128} cy={20} r={14} fill="#e0e7ff" opacity={0.08} />
      <circle cx={128} cy={20} r={7} fill="#e0e7ff" opacity={0.12} />
      <path d={moonLitPath(phase, 128, 20, 7)} fill="#eef2ff" opacity={0.92} />
      {reflect ? (
        <ellipse
          cx={128}
          cy={68}
          rx={5}
          ry={16}
          fill="#e0e7ff"
          style={{ animation: "wd-shimmer 7s ease-in-out infinite" }}
        />
      ) : null}
    </g>
  );
}

function Rain({ dots }: { dots: readonly SceneDot[] }) {
  return dots.map((dot, index) => (
    <line
      key={index}
      x1={dot.x}
      x2={dot.x - 1.2}
      y1={0}
      y2={dot.size * 4}
      stroke="#cbd5e1"
      strokeWidth={0.35}
      strokeLinecap="round"
      opacity={0.35}
      style={{ animation: `wd-fall ${dot.duration}s linear ${-dot.delay}s infinite` }}
    />
  ));
}

function Sea() {
  const layers = [
    { baseline: 62, amplitude: 1.6, wavelength: 40, fill: "#0e3a52", seconds: 34 },
    { baseline: 70, amplitude: 2, wavelength: 32, fill: "#0b2f45", seconds: 26 },
    { baseline: 79, amplitude: 2.4, wavelength: 80, fill: "#082236", seconds: 18 },
  ];

  return layers.map((layer) => (
    <path
      key={layer.baseline}
      d={sceneWavePath(layer.baseline, layer.amplitude, layer.wavelength)}
      fill={layer.fill}
      opacity={0.92}
      style={{ animation: `wd-drift ${layer.seconds}s linear infinite` }}
    />
  ));
}

function Embers({ dots }: { dots: readonly SceneDot[] }) {
  return dots.map((dot, index) => (
    <circle
      key={index}
      cx={dot.x}
      cy={dot.y}
      r={dot.size}
      fill="#fdba74"
      style={{ animation: `wd-rise ${dot.duration}s ease-out ${-dot.delay}s infinite` }}
    />
  ));
}

function Aurora({ id }: { id: string }) {
  const ribbons = [
    { d: "M -10 34 C 30 14, 70 40, 110 22 S 160 30, 180 18", colour: "#34d399", seconds: 16 },
    { d: "M -10 42 C 40 26, 80 50, 120 30 S 165 40, 180 28", colour: "#22d3ee", seconds: 22 },
    { d: "M -10 28 C 20 18, 60 34, 100 16 S 150 22, 180 10", colour: "#a78bfa", seconds: 28 },
  ];

  return (
    <g filter={`url(#${id}-blur)`}>
      {ribbons.map((ribbon) => (
        <path
          key={ribbon.colour}
          d={ribbon.d}
          stroke={ribbon.colour}
          strokeWidth={9}
          fill="none"
          strokeLinecap="round"
          style={{ animation: `wd-sway ${ribbon.seconds}s ease-in-out infinite` }}
        />
      ))}
    </g>
  );
}

export function WindDownScene({
  bed,
  seed,
  moving,
  date = new Date(),
}: {
  bed: DiscoverWindDownBed;
  seed: string;
  moving: boolean;
  date?: Date;
}) {
  const id = useId().replaceAll(":", "");
  const palette = WIND_DOWN_SCENES[bed];
  const stars =
    bed === "night" || bed === "aurora" || bed === "sea"
      ? scatterSceneDots(`${seed}:stars`, bed === "night" ? 46 : 26, {
          top: 2,
          bottom: bed === "sea" ? 54 : 70,
          size: [0.18, 0.55],
          duration: [3, 9],
        })
      : [];

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      className={`wd-scene absolute inset-0 size-full ${moving ? "" : "wd-still"}`}
    >
      <style>{SCENE_MOTION}</style>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.sky[0]} />
          <stop offset="100%" stopColor={palette.sky[1]} />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="100%" r="70%">
          <stop offset="0%" stopColor={palette.glow} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <filter id={`${id}-blur`} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <rect width={SCENE_WIDTH} height={SCENE_HEIGHT} fill={`url(#${id}-sky)`} />
      <rect width={SCENE_WIDTH} height={SCENE_HEIGHT} fill={`url(#${id}-glow)`} />
      <Stars dots={stars} />
      {bed === "aurora" ? <Aurora id={id} /> : null}
      {palette.moon ? <Moon phase={moonPhase(date)} reflect={bed === "sea"} /> : null}
      {bed === "sea" ? <Sea /> : null}
      {bed === "rain" ? (
        <Rain
          dots={scatterSceneDots(`${seed}:rain`, 70, {
            top: 0,
            bottom: 0,
            size: [1.2, 2.6],
            duration: [0.8, 1.6],
          })}
        />
      ) : null}
      {bed === "embers" ? (
        <Embers
          dots={scatterSceneDots(`${seed}:embers`, 28, {
            top: 78,
            bottom: 92,
            size: [0.3, 0.9],
            duration: [6, 12],
          })}
        />
      ) : null}
    </svg>
  );
}
