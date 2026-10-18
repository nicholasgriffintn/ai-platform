export interface OklchColor {
  lightness: number;
  chroma: number;
  hue: number;
}

const OKLCH_PATTERN =
  /^oklch\(\s*([0-9.]+)%?\s+([0-9.]+)\s+([0-9.]+)(?:deg)?\s*(?:\/\s*[0-9.]+%?\s*)?\)$/i;

export function parseOklch(value: string): OklchColor | null {
  const match = OKLCH_PATTERN.exec(value.trim());

  if (!match) {
    return null;
  }

  const rawLightness = Number(match[1]);
  const lightness = value.includes("%") && rawLightness > 1 ? rawLightness / 100 : rawLightness;

  return { lightness, chroma: Number(match[2]), hue: Number(match[3]) };
}

function linearToSrgbChannel(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));

  return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
}

function channelToHex(value: number): string {
  return Math.round(value * 255)
    .toString(16)
    .padStart(2, "0");
}

export function oklchToHex({ lightness, chroma, hue }: OklchColor): string {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const red = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const green = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const blue = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return `#${[red, green, blue].map((channel) => channelToHex(linearToSrgbChannel(channel))).join("")}`;
}

const HEX_PATTERN = /^#?([0-9a-f]{6})$/i;

function srgbToLinearChannel(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function hexToOklch(value: string): OklchColor | null {
  const hex = HEX_PATTERN.exec(value.trim())?.[1];

  if (!hex) {
    return null;
  }

  const [red = 0, green = 0, blue = 0] = [0, 2, 4].map((offset) =>
    srgbToLinearChannel(Number.parseInt(hex.slice(offset, offset + 2), 16) / 255),
  );

  const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);

  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const chroma = Math.hypot(a, b);
  const hue = chroma < 1e-4 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;

  return { lightness, chroma, hue };
}

export type RgbColor = readonly [number, number, number];

export function rgbDistance(left: RgbColor, right: RgbColor): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}
