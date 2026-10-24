import { getMediaPreview } from "@ngriffin_uk/polychat-component-experiences/media";
import { MediaPlayer } from "@ngriffin_uk/polychat-component-ui";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

const GENERATION_MODES = new Set(["image", "video", "audio"]);

function readGeneration(content: Record<string, unknown> | undefined) {
  if (!content) {
    return null;
  }

  const preview = getMediaPreview(content.output);

  if (!preview) {
    return null;
  }

  const mode = typeof content.mode === "string" ? content.mode : undefined;
  const type =
    preview.type === "unknown" && mode && GENERATION_MODES.has(mode) ? mode : preview.type;
  const prompt =
    isRecord(content.input) && typeof content.input.prompt === "string"
      ? content.input.prompt
      : undefined;
  const modelName = typeof content.modelName === "string" ? content.modelName : undefined;

  return { url: preview.url, type, prompt, modelName };
}

export function hasGenerationMedia(content: Record<string, unknown> | undefined): boolean {
  return readGeneration(content) !== null;
}

export function GenerationStage({
  title,
  content,
}: {
  title: string;
  content: Record<string, unknown> | undefined;
}) {
  const generation = readGeneration(content);

  if (!generation) {
    return null;
  }

  return (
    <figure className="flex h-full flex-col items-center justify-center gap-4 p-6">
      {generation.type === "video" || generation.type === "audio" ? (
        <MediaPlayer
          kind={generation.type}
          src={generation.url}
          title={title}
          className="w-full max-w-3xl"
        />
      ) : (
        <img
          src={generation.url}
          alt={generation.prompt ?? title}
          className="min-h-0 max-w-full flex-1 rounded-lg object-contain"
        />
      )}
      {generation.prompt ? (
        <figcaption className="max-w-2xl text-center text-sm text-muted-foreground">
          {generation.prompt}
          {generation.modelName ? (
            <span className="text-muted-foreground/70"> · {generation.modelName}</span>
          ) : null}
        </figcaption>
      ) : null}
    </figure>
  );
}
