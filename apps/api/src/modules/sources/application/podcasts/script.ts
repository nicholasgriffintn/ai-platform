import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import {
  PODCAST_FORMATS,
  podcastScriptSchema,
  type PodcastFormat,
  type PodcastLength,
  type PodcastScript,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { generateSystemObject } from "~/modules/models/application/system-object";
import { buildSourceMaterial } from "~/modules/sources/application/material";
import type { SourceRecord } from "~/modules/sources/infrastructure/SourceRepository";

import { PODCAST_HOSTS } from "./audio";

const LENGTH_GUIDANCE: Record<PodcastLength, string> = {
  short: "About 600 words, a five minute listen.",
  default: "About 1,400 words, a ten minute listen.",
  long: "About 2,600 words, a twenty minute listen.",
};

export async function writePodcastScript(
  context: ServiceContext,
  options: {
    sources: readonly SourceRecord[];
    format: PodcastFormat;
    length: PodcastLength;
    language: string;
    focus?: string;
  },
): Promise<PodcastScript> {
  const material = buildSourceMaterial(options.sources);

  if (!material) {
    throw new AssistantError(
      "The chosen sources have no text to talk about. Transcribe or add text first.",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return generateSystemObject(context, {
    role: "writing",
    name: "podcast_script",
    schema: podcastScriptSchema,
    system: renderPrompt("sources/podcast/script", {
      format: `${PODCAST_FORMATS[options.format].label}. ${PODCAST_FORMATS[options.format].description}`,
      length: LENGTH_GUIDANCE[options.length],
      hostName: PODCAST_HOSTS.host.name,
      guestName: PODCAST_HOSTS.guest.name,
      language: options.language,
      focus: options.focus,
    }),
    material,
  });
}
