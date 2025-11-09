import { replicateModelConfig as replicateAudioModelConfig } from "./audio";
import { replicateModelConfig as replicateImageModelConfig } from "./image";
import { replicateModelConfig as replicateVideoModelConfig } from "./video";

export const replicateModelConfig = {
	...replicateAudioModelConfig,
	...replicateImageModelConfig,
	...replicateVideoModelConfig,
};
