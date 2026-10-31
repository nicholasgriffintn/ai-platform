import type { AudioResponseFormat } from "@ngriffin_uk/polychat-ai-providers";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { SpeechProvider } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { base64ToBuffer } from "@ngriffin_uk/polychat-utility-server/base64";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { isProviderGuardrailBlockError } from "@ngriffin_uk/polychat-utility-server/provider-errors";
import { sanitiseInput } from "@ngriffin_uk/polychat-utility-server/sanitise";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { resolveServiceContext } from "~/infrastructure/context/serviceContext";
import { getAudioProvider } from "~/infrastructure/providers/capabilities/audio";
import { StorageService } from "~/infrastructure/storage";
import { splitForSpeech, splitSentences } from "~/modules/audio/domain/speech-text";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";
import type { IEnv, IFunctionResponse, IUser } from "~/types";

import { prepareSpeechInput } from "./input";
import { resolveSpeechVoice, type SpeechVoiceSelection } from "./speech-voice";
import { renderWithSpeechVoices } from "./speech-voices";

const logger = getLogger({ prefix: "audio/speech" });

type TextToSpeechRequest = {
  env: IEnv;
  input: string;
  user?: IUser;
  provider?: SpeechProvider;
  model?: string;
  lang?: string;
  store?: boolean;
  voice_id?: string;
  ref_audio?: string;
  response_format?: AudioResponseFormat;
  expressiveness?: number;
  context?: ServiceContext;
};

export async function synthesiseSpeech(
  context: ServiceContext,
  selection: SpeechVoiceSelection,
  text: string,
  language: string,
): Promise<Uint8Array> {
  const user = context.requireUser();
  const result = await getAudioProvider(selection.provider, {
    env: context.env,
    user,
    serviceContext: context,
  }).synthesize({
    input: text,
    env: context.env,
    user,
    store: false,
    model: selection.model,
    voice: selection.voice,
    locale: language,
  });

  if (!result.audioBase64) {
    throw new AssistantError("No speech was generated", ErrorType.PROVIDER_ERROR);
  }

  return new Uint8Array(base64ToBuffer(result.audioBase64));
}

async function voicePieces(
  pieces: readonly string[],
  speak: (text: string) => Promise<Uint8Array>,
  retrySentences: boolean,
): Promise<Uint8Array[]> {
  const segments: Uint8Array[] = [];

  for (const piece of pieces) {
    try {
      segments.push(await speak(piece));
    } catch (error) {
      if (!isProviderGuardrailBlockError(error)) {
        throw error;
      }

      const sentences = splitSentences(piece);

      if (retrySentences && sentences.length > 1) {
        segments.push(...(await voicePieces(sentences, speak, false)));
      } else {
        logger.warn("Skipped speech the provider's moderation blocked", {
          characters: piece.length,
        });
      }
    }
  }

  return segments;
}

export function synthesiseSpeechText(
  context: ServiceContext,
  selection: SpeechVoiceSelection,
  text: string,
  language: string,
): Promise<Uint8Array[]> {
  return voicePieces(
    splitForSpeech(text),
    (piece) => synthesiseSpeech(context, selection, piece, language),
    true,
  );
}

export const handleTextToSpeech = async (
  req: TextToSpeechRequest,
): Promise<IFunctionResponse | IFunctionResponse[]> => {
  const { input: rawInput, env, user, lang = "en", store = true } = req;

  const input = sanitiseInput(rawInput);

  if (!input) {
    throw new AssistantError("Missing input", ErrorType.PARAMS_ERROR);
  }

  const userSettings = user?.id
    ? await new UserSettingsRepository(env).getUserSettings(user.id)
    : null;
  const storage = store ? new StorageService(env.PRIVATE_ASSETS_BUCKET) : undefined;
  const slug = `tts/${generateId()}`;

  const { selection, preparedInput, synthesisResult } = await renderWithSpeechVoices(
    async () => ({
      selection: await resolveSpeechVoice(env, user, {
        role: "narrator",
        settings: userSettings,
        provider: req.provider,
        model: req.model,
        voice: req.voice_id,
      }),
    }),
    async ({ selection }) => {
      const preparedInput = prepareSpeechInput(input, selection.provider);
      const synthesisResult = await getAudioProvider(selection.provider, { env, user }).synthesize({
        input: preparedInput.input,
        env,
        user,
        slug,
        storage,
        store,
        model: selection.model,
        voice: selection.voice,
        locale: lang,
        refAudio: req.ref_audio,
        responseFormat: req.response_format,
        expressiveness: req.expressiveness ?? userSettings?.speech_expressiveness ?? undefined,
        metadata: preparedInput.metadata,
      });

      return { selection, preparedInput, synthesisResult };
    },
  );

  if (!synthesisResult) {
    throw new AssistantError("No response from the text-to-speech service");
  }

  const audioKey = synthesisResult.key;
  const normalizedKey = audioKey?.replace(/^\//, "");
  let audioOutputId: string | undefined;
  let audioUrl = synthesisResult.url;

  if (store && normalizedKey && !audioUrl && user) {
    const storedAsset = await StorageService.forPrivateAssets(
      resolveServiceContext({ context: req.context, env, user }),
    ).recordOutputFile({
      key: normalizedKey,
      createdByUserId: user.id,
      capabilityId: "speech",
      kind: "speech",
      title: "Generated speech",
      content: { provider: selection.provider, model: selection.id, voice: selection.voice },
      mimeType: synthesisResult.audioMimeType || "audio/mpeg",
      filename: normalizedKey.split("/").at(-1) ?? null,
    });

    audioOutputId = storedAsset.outputId;
    audioUrl = storedAsset.url;
  }

  const responseText = synthesisResult.response;
  const metadata =
    preparedInput.metadata || synthesisResult.metadata
      ? {
          ...preparedInput.metadata,
          ...synthesisResult.metadata,
        }
      : undefined;
  const linkText = audioUrl ? `[Listen to the audio](${audioUrl})` : undefined;

  let content: string;

  if (responseText && linkText) {
    content = `${responseText}\n${linkText}`;
  } else if (responseText) {
    content = responseText;
  } else if (audioKey) {
    content = audioKey;
  } else if (linkText) {
    content = linkText;
  } else {
    content = "Audio generated successfully";
  }

  return {
    status: "success",
    content,
    data: {
      provider: selection.provider,
      model: selection.id,
      voice: selection.voice,
      audioOutputId,
      audioKey,
      audioUrl,
      audioBase64: synthesisResult.audioBase64,
      audioDataUrl: synthesisResult.audioDataUrl,
      audioMimeType: synthesisResult.audioMimeType,
      response: responseText,
      metadata,
    },
  };
};
