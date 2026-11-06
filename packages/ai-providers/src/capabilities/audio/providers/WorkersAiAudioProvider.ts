import { SPEECH_PROVIDER_VOICES } from "@ngriffin_uk/polychat-schemas";
import { readStreamBytes } from "@ngriffin_uk/polychat-utility-core";
import { bufferToBase64 } from "@ngriffin_uk/polychat-utility-server/base64";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { resolveAiGatewayId } from "../../../gateway.js";
import { requireRequestModel } from "../../../utils/required-model.js";
import { BaseAudioProvider } from "../base.js";
import type { AudioProvider, AudioSynthesisRequest, AudioSynthesisResult } from "../index.js";

const SPANISH_MODEL = "@cf/deepgram/aura-2-es";
const SPANISH_VOICE = "aquila";
const ENGLISH_ONLY_MODELS = new Set(["@cf/deepgram/aura-1", "@cf/deepgram/aura-2-en"]);

function resolveSpeechModel(requested: string, locale = "en"): string {
  const language = locale.toLowerCase().slice(0, 2);

  if (language === "en" || !ENGLISH_ONLY_MODELS.has(requested)) {
    return requested;
  }

  if (language === "es") {
    return SPANISH_MODEL;
  }

  throw new AssistantError(
    `Workers AI has no voice for "${locale}". Choose another speech provider.`,
    ErrorType.PARAMS_ERROR,
  );
}

async function readSpeechBytes(result: unknown): Promise<Uint8Array> {
  if (result instanceof ReadableStream) {
    return readStreamBytes(result);
  }

  if (result instanceof ArrayBuffer) {
    return new Uint8Array(result);
  }

  if (result instanceof Uint8Array) {
    return result;
  }

  throw new AssistantError("Workers AI returned no speech", ErrorType.PROVIDER_ERROR);
}

export class WorkersAiAudioProvider extends BaseAudioProvider implements AudioProvider {
  name = "workers-ai";

  async synthesize(request: AudioSynthesisRequest): Promise<AudioSynthesisResult> {
    if (!request.env.AI) {
      throw new AssistantError("Workers AI is not configured", ErrorType.CONFIGURATION_ERROR);
    }

    const requested = requireRequestModel(request.model, "speech");
    const model = resolveSpeechModel(requested, request.locale);
    const voice =
      model === SPANISH_MODEL
        ? SPANISH_VOICE
        : (request.voice ?? SPEECH_PROVIDER_VOICES["workers-ai"].roles.narrator);
    const audio = await readSpeechBytes(
      await request.env.AI.run(
        model,
        { text: request.input, speaker: voice, encoding: "mp3" },
        {
          gateway: {
            id: resolveAiGatewayId(),
            skipCache: false,
            metadata: request.user?.email ? { email: request.user.email } : {},
          },
        },
      ),
    );
    const metadata = {
      ...request.metadata,
      engine: "workers-ai",
      model,
      voice,
    };

    if (!request.store) {
      const audioBase64 = bufferToBase64(audio);

      return {
        audioBase64,
        audioDataUrl: `data:audio/mpeg;base64,${audioBase64}`,
        audioMimeType: "audio/mpeg",
        metadata,
      };
    }

    const key = this.buildObjectKey(this.resolveSlugBase(request));

    await this.requireStorage(request).uploadObject(key, audio);

    return { key, audioMimeType: "audio/mpeg", metadata };
  }
}
