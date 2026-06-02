import { listModels } from "~/services/models";
import type { IEnv } from "~/types";

function matchesRequestedModel(
	requestedModel: string,
	modelId: string,
	model: {
		matchingModel?: string;
		name?: string;
	},
): boolean {
	return (
		modelId === requestedModel ||
		model.matchingModel === requestedModel ||
		model.name === requestedModel
	);
}

export async function userCanAccessRealtimeModel({
	env,
	userId,
	model,
}: {
	env: IEnv;
	userId: number;
	model: string;
}): Promise<boolean> {
	const accessibleModels = await listModels(env, userId);

	return Object.entries(accessibleModels).some(([modelId, config]) =>
		matchesRequestedModel(model, modelId, config),
	);
}
