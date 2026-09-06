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
