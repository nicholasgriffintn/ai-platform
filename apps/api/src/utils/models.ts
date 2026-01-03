import type { ModelConfig } from "~/types";

export function getModelIdsByOutput(
	config: ModelConfig,
	provider: string,
	modality: "image" | "audio" | "video" | "speech",
) {
	return Object.entries(config)
		.filter(
			([, model]) =>
				model.provider === provider &&
				(model.modalities?.output ?? []).includes(modality),
		)
		.map(([id]) => id);
}
