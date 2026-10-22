import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import {
  PODCAST_FORMATS,
  podcastScriptSchema,
  type PodcastFormat,
  type PodcastLength,
  type PodcastScript,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { ai } from "~/infrastructure/ai";
import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { getAuxiliaryModel } from "~/modules/models/application/resolve";
import type { SourceRecord } from "~/modules/sources/infrastructure/SourceRepository";

import { PODCAST_HOSTS } from "./audio";

const MAX_MATERIAL_CHARACTERS = 80_000;

const LENGTH_GUIDANCE: Record<PodcastLength, string> = {
  short: "About 600 words, a five minute listen.",
  default: "About 1,400 words, a ten minute listen.",
  long: "About 2,600 words, a twenty minute listen.",
};

export function buildPodcastMaterial(sources: readonly SourceRecord[]): string {
  let remaining = MAX_MATERIAL_CHARACTERS;
  const sections: string[] = [];

  for (const source of sources) {
    const body = (source.content ?? source.external_uri ?? "").trim();

    if (!body || remaining <= 0) {
      continue;
    }

    const excerpt = body.slice(0, remaining);

    remaining -= excerpt.length;
    sections.push(`## ${source.title}\n\n${excerpt}`);
  }

  return sections.join("\n\n");
}

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
  const material = buildPodcastMaterial(options.sources);

  if (!material) {
    throw new AssistantError(
      "The chosen sources have no text to talk about. Transcribe or add text first.",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const user = context.requireUser();
  const { model, provider, effort } = await getAuxiliaryModel(context.env, user);
  const { object } = await ai.generateObject({
    env: context.env,
    user,
    model,
    provider,
    reasoning_effort: effort,
    disable_functions: true,
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
    prompt: material,
  });

  return object;
}
