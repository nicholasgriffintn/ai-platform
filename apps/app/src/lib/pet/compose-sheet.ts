import { PET_CLIP_NAMES, PET_CLIPS, PET_SHEET_LAYOUT } from "@ngriffin_uk/polychat-schemas";

interface Pose {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
}

const TAU = Math.PI * 2;
const wave = (i: number, n: number) => Math.sin((i / n) * TAU);
const swell = (i: number, n: number) => Math.sin((i / n) * Math.PI);

function neutral(): Pose {
  return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
}

function poseFor(clip: string, i: number, n: number): Pose {
  const pose = neutral();

  switch (clip) {
    case "idle":
      pose.y = -4 * swell(i, n);
      pose.rotation = 1.2 * wave(i, n);
      break;
    case "blink":
      pose.y = [-1, -2, -2, -1][i] ?? 0;
      pose.scaleY = [1, 0.97, 0.97, 1][i] ?? 1;
      break;
    case "preen":
      pose.rotation = [0, -9, -18, -18, -8, 0][i] ?? 0;
      pose.y = [0, 2, 5, 5, 2, 0][i] ?? 0;
      break;
    case "greet":
      pose.rotation = [0, 6, 9, 4][i] ?? 0;
      pose.y = [0, -5, -8, -4][i] ?? 0;
      break;
    case "think":
      pose.rotation = -9 - 3 * swell(i, n);
      pose.y = -2 * swell(i, n);
      break;
    case "work":
      pose.y = -6 * Math.abs(Math.sin((i / n) * TAU * 2));
      pose.rotation = 3 * wave(i, n);
      break;
    case "speak":
      pose.y = [0, -2, -1, -3, -1, 0][i] ?? 0;
      pose.rotation = [0, 2, 0.5, 3, 1, 0][i] ?? 0;
      break;
    case "cheer":
      pose.y = [0, -18, -26, -12, -3, 0][i] ?? 0;
      pose.scaleY = [1, 0.94, 0.97, 1.06, 1.01, 1][i] ?? 1;
      pose.scaleX = [1, 1.04, 1.02, 0.96, 0.99, 1][i] ?? 1;
      break;
    case "fret":
      pose.rotation = 6;
      pose.x = 1.4 * Math.sin((i / n) * TAU * 3);
      pose.y = 2;
      break;
    case "doze":
      pose.y = -3 * swell(i, n);
      pose.scaleY = 1 + 0.03 * swell(i, n);
      pose.rotation = 3;
      pose.opacity = 0.75;
      break;
    case "flit":
      pose.y = -12 * Math.sin((i / n) * TAU + Math.PI / 2) - 6;
      pose.rotation = 5 * wave(i, n);
      break;
    default:
      break;
  }

  return pose;
}

export interface ComposePetSheetOptions {
  padding?: number;
  quality?: number;
}

export async function composePetSheet(
  source: Blob | string,
  options: ComposePetSheetOptions = {},
): Promise<Blob> {
  const image = await loadImage(source);
  const { frameWidth, frameHeight, columns, rows, sheetWidth, sheetHeight } = PET_SHEET_LAYOUT;

  const canvas = document.createElement("canvas");

  canvas.width = sheetWidth;
  canvas.height = sheetHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("This browser cannot compose a sprite sheet");
  }

  const padding = options.padding ?? 14;
  const box = Math.min(frameWidth, frameHeight) - padding * 2;
  const ratio = Math.min(box / image.width, box / image.height);
  const drawWidth = image.width * ratio;
  const drawHeight = image.height * ratio;
  const baseline = frameHeight - padding;

  context.imageSmoothingQuality = "high";

  PET_CLIP_NAMES.forEach((name, row) => {
    if (row >= rows) {
      return;
    }

    const clip = PET_CLIPS[name];

    for (let column = 0; column < Math.min(clip.frames, columns); column += 1) {
      const pose = poseFor(name, column, clip.frames);
      const originX = column * frameWidth + frameWidth / 2;
      const originY = row * frameHeight + baseline;

      context.save();
      context.globalAlpha = pose.opacity;
      context.translate(originX + pose.x, originY + pose.y);
      context.rotate((pose.rotation * Math.PI) / 180);
      context.scale(pose.scaleX, pose.scaleY);
      context.drawImage(image, -drawWidth / 2, -drawHeight, drawWidth, drawHeight);
      context.restore();
    }
  });

  return await canvasToBlob(canvas, options.quality ?? 0.92);
}

function loadImage(source: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = typeof source === "string" ? null : URL.createObjectURL(source);

    image.addEventListener(
      "load",
      () => {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }

        resolve(image);
      },
      { once: true },
    );

    image.addEventListener(
      "error",
      () => {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }

        reject(new Error("The image could not be read"));
      },
      { once: true },
    );

    image.src = objectUrl ?? (source as string);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);

          return;
        }

        reject(new Error("The sprite sheet could not be encoded"));
      },
      "image/webp",
      quality,
    );
  });
}
