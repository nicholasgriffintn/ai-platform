import { listModels } from "~/services/models";
import type { ModelConfigItem } from "@assistant/schemas";
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
	return Boolean(await getAccessibleRealtimeModel({ env, userId, model }));
}

export async function getAccessibleRealtimeModel({
	env,
	userId,
	model,
}: {
	env: IEnv;
	userId: number;
	model: string;
}): Promise<ModelConfigItem | undefined> {
	const accessibleModels = await listModels(env, userId);

	return Object.entries(accessibleModels).find(([modelId, config]) =>
		matchesRequestedModel(model, modelId, config),
	)?.[1];
}
