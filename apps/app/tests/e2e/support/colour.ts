import type { Locator } from "@playwright/test";

export async function renderedColourChannels(
  locator: Locator,
  property: "backgroundColor" | "color",
) {
  return locator.evaluate((element, cssProperty) => {
    const canvas = document.createElement("canvas");

    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      throw new Error("Canvas colour conversion is unavailable");
    }

    context.fillStyle = getComputedStyle(element)[cssProperty];
    context.fillRect(0, 0, 1, 1);

    return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3));
  }, property);
}

export async function customPropertyColourChannels(locator: Locator, property: string) {
  return locator.evaluate((element, cssProperty) => {
    const value = getComputedStyle(element).getPropertyValue(cssProperty).trim();

    if (!value) {
      throw new Error(`No value resolved for ${cssProperty}`);
    }

    const canvas = document.createElement("canvas");

    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      throw new Error("Canvas colour conversion is unavailable");
    }

    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);

    return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3));
  }, property);
}

export function relativeLuminance(channels: number[]) {
  if (channels.length !== 3 || channels.some((channel) => !Number.isFinite(channel))) {
    throw new Error(`Unsupported colour channels: ${channels.join(", ")}`);
  }

  const [red = 0, green = 0, blue = 0] = channels.map((channel) => {
    const value = channel / 255;

    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

export function contrastRatio(first: number[], second: number[]) {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);

  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
