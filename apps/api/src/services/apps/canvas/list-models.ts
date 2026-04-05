import type { IEnv } from "~/types";
import { listModelsByOutputModality } from "~/services/models";
import type { CanvasMode, CanvasModelListItem } from "./types";
import { modelRequiresCanvasReferenceImage } from "./input-requirements";

function supportsCanvasGenerationPrompt(model: CanvasModelListItem): boolean {
	return (
		model.inputSchema?.fields?.some((field) => field.name === "prompt") ?? false
	);
}

export async function listCanvasModels({
	env,
	mode,
	userId,
}: {
	env: IEnv;
	mode: CanvasMode;
	userId?: number;
}): Promise<CanvasModelListItem[]> {
	const models = await listModelsByOutputModality(env, mode, userId);

	return Object.entries(models)
		.map(([id, model]) => ({
			id,
			name: model.name ?? id,
			description: model.description,
			provider: model.provider,
			costPerRun: model.costPerRun,
			modalities: model.modalities,
			strengths: model.strengths,
			isFeatured: model.isFeatured,
			requiresReferenceImage: modelRequiresCanvasReferenceImage(model),
			inputSchema: model.inputSchema,
		}))
		.filter((model) => supportsCanvasGenerationPrompt(model))
		.sort((a, b) => {
			if (a.isFeatured && !b.isFeatured) return -1;
			if (!a.isFeatured && b.isFeatured) return 1;
			return a.name.localeCompare(b.name);
		});
}
