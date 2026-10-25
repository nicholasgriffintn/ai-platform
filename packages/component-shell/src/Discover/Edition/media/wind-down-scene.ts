import type { DiscoverWindDownBed } from "@ngriffin_uk/polychat-schemas";
import { createSeededRandom } from "@ngriffin_uk/polychat-utility-core";

export const SCENE_WIDTH = 160;
export const SCENE_HEIGHT = 90;

export interface SceneDot {
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
}

export interface WindDownScenePalette {
  sky: readonly [string, string];
  glow: string;
  moon: boolean;
}

export const WIND_DOWN_SCENES: Record<DiscoverWindDownBed, WindDownScenePalette> = {
  night: { sky: ["#0b1026", "#1e1b4b"], glow: "#6366f155", moon: true },
  rain: { sky: ["#0b1220", "#1e293b"], glow: "#64748b40", moon: false },
  sea: { sky: ["#071330", "#0e4a5c"], glow: "#22d3ee30", moon: true },
  embers: { sky: ["#140a07", "#3b1206"], glow: "#f9731666", moon: false },
  aurora: { sky: ["#020617", "#0b1d2e"], glow: "#34d39940", moon: true },
};

export function scatterSceneDots(
  seed: string,
  count: number,
  options: {
    top: number;
    bottom: number;
    size: readonly [number, number];
    duration: readonly [number, number];
  },
): SceneDot[] {
  const random = createSeededRandom(seed);
  const between = (min: number, max: number) => min + random() * (max - min);

  return Array.from({ length: count }, () => ({
    x: between(0, SCENE_WIDTH),
    y: between(options.top, options.bottom),
    size: between(options.size[0], options.size[1]),
    delay: between(0, options.duration[1]),
    duration: between(options.duration[0], options.duration[1]),
  }));
}

export function sceneWavePath(baseline: number, amplitude: number, wavelength: number): string {
  const points: string[] = [`M 0 ${SCENE_HEIGHT}`, `L 0 ${baseline}`];

  for (let x = 0; x <= SCENE_WIDTH * 2; x += wavelength / 2) {
    const crest = (x / (wavelength / 2)) % 2 === 0 ? -amplitude : amplitude;

    points.push(`Q ${x + wavelength / 4} ${baseline + crest} ${x + wavelength / 2} ${baseline}`);
  }

  points.push(`L ${SCENE_WIDTH * 2 + wavelength} ${SCENE_HEIGHT}`, "Z");

  return points.join(" ");
}
