import type { ModelConfig } from "~/types";
import { workersAiModelConfig as workersAiAudioModelConfig } from "./audio";
import { workersAiModelConfig as workersAiChatModelConfig } from "./chat";
import { workersAiModelConfig as workersAiImageModelConfig } from "./image";
import { workersAiModelConfig as workersAiTranscriptionModelConfig } from "./transcription";
import { workersAiModelConfig as workersAiVideoModelConfig } from "./video";
import { oldWorkersAiModelConfig } from "./old";

export const workersAiModelConfig: ModelConfig = {
	...workersAiChatModelConfig,
	...workersAiImageModelConfig,
	...workersAiVideoModelConfig,
	...workersAiAudioModelConfig,
	...workersAiTranscriptionModelConfig,
	...oldWorkersAiModelConfig,
};
