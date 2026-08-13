export function normalizeSelectedModel(model?: string | null): string | undefined {
	return model === null ? undefined : model;
}

export function resolveRequestModel(
	currentModel?: string | null,
	overrideModelId?: string | null,
): string | undefined {
	return overrideModelId || normalizeSelectedModel(currentModel);
}
