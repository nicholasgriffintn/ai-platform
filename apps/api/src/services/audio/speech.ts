import { CartesiaService } from "~/lib/audio/cartesia";
import { ElevenLabsService } from "~/lib/audio/elevenlabs";
import { MelottsService } from "~/lib/audio/melotts";
import { PollyService } from "~/lib/audio/polly";
import { StorageService } from "~/lib/storage";
import type { IEnv, IFunctionResponse, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { sanitiseInput } from "../../lib/chat/utils";

type TextToSpeechRequest = {
  env: IEnv;
  input: string;
  user: IUser;
  provider?: "polly" | "cartesia" | "elevenlabs" | "melotts";
  lang?: string;
};

export const handleTextToSpeech = async (
  req: TextToSpeechRequest,
): Promise<IFunctionResponse | IFunctionResponse[]> => {
  const { input: rawInput, env, user, provider = "polly", lang = "en" } = req;

  const input = sanitiseInput(rawInput);

  if (!input) {
    throw new AssistantError("Missing input", ErrorType.PARAMS_ERROR);
  }

  if (input.length > 4096) {
    throw new AssistantError("Input is too long", ErrorType.PARAMS_ERROR);
  }

  const storage = new StorageService(env.ASSETS_BUCKET);
  const slug = `tts/${encodeURIComponent(user?.email || "unknown").replace(/[^a-zA-Z0-9]/g, "-")}-${generateId()}`;

  let response: string | { response: string; url: string };

  if (provider === "elevenlabs") {
    const elevenlabs = new ElevenLabsService(env, user);
    response = await elevenlabs.synthesizeSpeech(input, storage, slug);
  } else if (provider === "cartesia") {
    const cartesia = new CartesiaService(env, user);
    response = await cartesia.synthesizeSpeech(input, storage, slug);
  } else if (provider === "polly") {
    const polly = new PollyService(env, user);

    response = await polly.synthesizeSpeech(input, storage, slug);
  } else {
    const melotts = new MelottsService(env, user);

    response = await melotts.synthesizeSpeech(input, lang);
  }

  if (!response) {
    throw new AssistantError("No response from the text-to-speech service");
  }

  const baseAssetsUrl = env.PUBLIC_ASSETS_URL || "";
  return {
    status: "success",
    content:
      typeof response === "string"
        ? response
        : `${response.response}\n[Listen to the audio](${response.url})`,
    data:
      typeof response === "string"
        ? {
            audioKey: response,
            audioUrl: `${baseAssetsUrl}/${response}`,
            provider,
          }
        : response,
  };
};
