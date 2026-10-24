import { SPEECH_PROVIDER_VOICES } from "@ngriffin_uk/polychat-schemas";
import { isRecord, readStreamBytes } from "@ngriffin_uk/polychat-utility-core";
import { base64ToBuffer, bufferToBase64 } from "@ngriffin_uk/polychat-utility-server/base64";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { resolveAiGatewayId } from "../../../gateway.js";
import { BaseAudioProvider } from "../base.js";
import type { AudioProvider, AudioSynthesisRequest, AudioSynthesisResult } from "../index.js";

const DEFAULT_MODEL = "@cf/deepgram/aura-1";
const MELOTTS_MODEL = "@cf/myshell-ai/melotts";
const ENGLISH_ONLY_MODELS = new Set([DEFAULT_MODEL, "@cf/deepgram/aura-2-en"]);

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

  if (isRecord(result) && typeof result.audio === "string" && result.audio) {
    return new Uint8Array(base64ToBuffer(result.audio));
  }

  throw new AssistantError("Workers AI returned no speech", ErrorType.PROVIDER_ERROR);
}

export class WorkersAiAudioProvider extends BaseAudioProvider implements AudioProvider {
  name = "workers-ai";

  async synthesize(request: AudioSynthesisRequest): Promise<AudioSynthesisResult> {
    if (!request.env.AI) {
      throw new AssistantError("Workers AI is not configured", ErrorType.CONFIGURATION_ERROR);
    }

    const requested = request.model ?? DEFAULT_MODEL;
    const english = (request.locale ?? "en").toLowerCase().startsWith("en");
    const model = !english && ENGLISH_ONLY_MODELS.has(requested) ? MELOTTS_MODEL : requested;
    const voice = request.voice ?? SPEECH_PROVIDER_VOICES["workers-ai"].roles.narrator;
    const input =
      model === MELOTTS_MODEL
        ? { prompt: request.input, lang: request.locale?.slice(0, 2) || "en" }
        : { text: request.input, speaker: voice, encoding: "mp3" };
    const audio = await readSpeechBytes(
      await request.env.AI.run(model, input, {
        gateway: {
          id: resolveAiGatewayId(),
          skipCache: false,
          metadata: request.user?.email ? { email: request.user.email } : {},
        },
      }),
    );
    const metadata = {
      ...request.metadata,
      engine: "workers-ai",
      model,
      voice: model === MELOTTS_MODEL ? undefined : voice,
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
