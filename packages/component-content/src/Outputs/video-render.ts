import type {
  VideoOverviewOutputContent,
  VideoOverviewScene,
  VideoOverviewStyle,
} from "@ngriffin_uk/polychat-schemas";

import { findSceneAt, sceneStartSeconds } from "./video-timing";

export const VIDEO_WIDTH = 1280;
export const VIDEO_HEIGHT = 720;

const CROSSFADE_SECONDS = 0.8;
const KEN_BURNS_ZOOM = 0.12;
const TITLE_CARD_SECONDS = 4;

const STYLE_BACKDROPS: Record<VideoOverviewStyle, { from: string; to: string; ink: string }> = {
  classic: { from: "#1f2937", to: "#0f172a", ink: "#f8fafc" },
  whiteboard: { from: "#ffffff", to: "#f1f5f9", ink: "#111827" },
  watercolour: { from: "#e0f2fe", to: "#fde2e4", ink: "#1e293b" },
  retro_print: { from: "#fef3c7", to: "#fde68a", ink: "#1c1917" },
  heritage: { from: "#f5f5f4", to: "#d6d3d1", ink: "#292524" },
  papercraft: { from: "#ffedd5", to: "#fed7aa", ink: "#292524" },
  kawaii: { from: "#fce7f3", to: "#fbcfe8", ink: "#500724" },
  anime: { from: "#4338ca", to: "#c026d3", ink: "#ffffff" },
};

export interface VideoFrameInput {
  content: VideoOverviewOutputContent;
  title: string;
  images: readonly (ImageBitmap | null)[];
  seconds: number;
  durationSeconds: number;
}

function sceneWindow(input: VideoFrameInput, index: number) {
  const start = sceneStartSeconds(input.content.timings, index, input.durationSeconds);
  const next =
    index + 1 < input.content.scenes.length
      ? sceneStartSeconds(input.content.timings, index + 1, input.durationSeconds)
      : input.durationSeconds;

  return { start, end: Math.max(next, start + 0.1) };
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: ImageBitmap,
  progress: number,
  index: number,
) {
  const scale = 1 + KEN_BURNS_ZOOM * (index % 2 === 0 ? progress : 1 - progress);
  const ratio = Math.max(VIDEO_WIDTH / image.width, VIDEO_HEIGHT / image.height);
  const width = image.width * ratio * scale;
  const height = image.height * ratio * scale;
  const drift = (index % 3) - 1;
  const x = (VIDEO_WIDTH - width) / 2 + drift * progress * 24;
  const y = (VIDEO_HEIGHT - height) / 2;

  context.drawImage(image, x, y, width, height);
}

function drawBackdrop(context: CanvasRenderingContext2D, style: VideoOverviewStyle) {
  const backdrop = STYLE_BACKDROPS[style];
  const gradient = context.createLinearGradient(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);

  gradient.addColorStop(0, backdrop.from);
  gradient.addColorStop(1, backdrop.to);
  context.fillStyle = gradient;
  context.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
}

function wrapLines(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";

  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;

    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  return line ? [...lines, line] : lines;
}

function drawScene(
  context: CanvasRenderingContext2D,
  input: VideoFrameInput,
  scene: VideoOverviewScene,
  index: number,
  progress: number,
) {
  const image = input.images[index];

  if (image) {
    drawCover(context, image, progress, index);

    return;
  }

  const backdrop = STYLE_BACKDROPS[input.content.style];

  drawBackdrop(context, input.content.style);
  context.fillStyle = backdrop.ink;
  context.font = "600 56px ui-sans-serif, system-ui, sans-serif";
  wrapLines(context, scene.title, VIDEO_WIDTH * 0.75).forEach((line, lineIndex, lines) => {
    context.fillText(
      line,
      VIDEO_WIDTH * 0.12,
      VIDEO_HEIGHT / 2 - (lines.length - 1) * 34 + lineIndex * 68,
    );
  });
}

function drawCaption(context: CanvasRenderingContext2D, text: string, opacity: number) {
  context.save();
  context.globalAlpha = opacity;
  context.font = "600 34px ui-sans-serif, system-ui, sans-serif";

  const lines = wrapLines(context, text, VIDEO_WIDTH * 0.7);
  const lineHeight = 44;
  const boxHeight = lines.length * lineHeight + 32;
  const boxWidth = Math.max(...lines.map((line) => context.measureText(line).width)) + 48;

  context.fillStyle = "rgba(0, 0, 0, 0.55)";
  context.fillRect(56, VIDEO_HEIGHT - boxHeight - 56, boxWidth, boxHeight);
  context.fillStyle = "#ffffff";
  lines.forEach((line, lineIndex) => {
    context.fillText(line, 80, VIDEO_HEIGHT - boxHeight - 56 + 46 + lineIndex * lineHeight);
  });
  context.restore();
}

function drawTitleCard(context: CanvasRenderingContext2D, title: string, opacity: number) {
  context.save();
  context.globalAlpha = opacity;

  const gradient = context.createLinearGradient(0, VIDEO_HEIGHT * 0.45, 0, VIDEO_HEIGHT);

  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.75)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
  context.fillStyle = "#ffffff";
  context.font = "700 64px ui-serif, Georgia, serif";
  wrapLines(context, title, VIDEO_WIDTH * 0.8).forEach((line, lineIndex) => {
    context.fillText(line, 72, VIDEO_HEIGHT - 150 + lineIndex * 72);
  });
  context.restore();
}

export function drawVideoFrame(context: CanvasRenderingContext2D, input: VideoFrameInput): number {
  const { scenes, timings } = input.content;
  const index = findSceneAt(timings, input.seconds, input.durationSeconds);
  const scene = scenes[index];

  context.clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);

  if (!scene) {
    return index;
  }

  const span = sceneWindow(input, index);
  const progress = Math.min(1, Math.max(0, (input.seconds - span.start) / (span.end - span.start)));
  const sinceStart = input.seconds - span.start;
  const previous = index > 0 ? scenes[index - 1] : undefined;

  if (previous && sinceStart < CROSSFADE_SECONDS) {
    drawScene(context, input, previous, index - 1, 1);
    context.save();
    context.globalAlpha = Math.max(0, sinceStart / CROSSFADE_SECONDS);
    drawScene(context, input, scene, index, progress);
    context.restore();
  } else {
    drawScene(context, input, scene, index, progress);
  }

  if (index === 0 && input.seconds < TITLE_CARD_SECONDS) {
    drawTitleCard(context, input.title, Math.min(1, (TITLE_CARD_SECONDS - input.seconds) / 1));
  } else if (scene.caption) {
    drawCaption(context, scene.caption, Math.min(1, sinceStart / CROSSFADE_SECONDS));
  }

  return index;
}

export function loadVideoImages(images: readonly (Blob | null)[]): Promise<(ImageBitmap | null)[]> {
  return Promise.all(
    images.map((image) =>
      image ? createImageBitmap(image).catch(() => null) : Promise.resolve(null),
    ),
  );
}

const RECORDING_TYPES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];

export function recordVideo(params: {
  input: Omit<VideoFrameInput, "seconds" | "durationSeconds">;
  narration: Blob;
  onProgress: (fraction: number) => void;
}): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const audioUrl = URL.createObjectURL(params.narration);
    const audio = new Audio(audioUrl);
    const mimeType = RECORDING_TYPES.find((type) => MediaRecorder.isTypeSupported(type));

    if (!context || !mimeType) {
      URL.revokeObjectURL(audioUrl);
      reject(new Error("This browser cannot record video"));

      return;
    }

    canvas.width = VIDEO_WIDTH;
    canvas.height = VIDEO_HEIGHT;

    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    audioContext.createMediaElementSource(audio).connect(destination);

    const stream = new MediaStream([
      ...canvas.captureStream(30).getVideoTracks(),
      ...destination.stream.getAudioTracks(),
    ]);
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];
    let frame = 0;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onstop = () => {
      cancelAnimationFrame(frame);
      void audioContext.close();
      resolve(new Blob(chunks, { type: "video/webm" }));
    };

    const draw = () => {
      drawVideoFrame(context, {
        ...params.input,
        seconds: audio.currentTime,
        durationSeconds: audio.duration,
      });
      params.onProgress(audio.duration ? audio.currentTime / audio.duration : 0);
      frame = requestAnimationFrame(draw);
    };

    audio.addEventListener("ended", () => recorder.stop(), { once: true });
    audio.addEventListener("error", () => reject(new Error("The narration could not be read")), {
      once: true,
    });
    audio.addEventListener(
      "canplaythrough",
      () => {
        recorder.start(1000);
        draw();
        void audio.play().catch(reject);
      },
      { once: true },
    );
    audio.load();
  });
}
