const TOOL_ID_PATTERN = /^[a-zA-Z0-9_:-]+$/;

export function normaliseToolIds(value: string | string[] | undefined): string[] {
	const rawTools = Array.isArray(value) ? value : (value ?? "").split(",");

	return Array.from(
		new Set(
			rawTools.map((toolId) => toolId.trim()).filter((toolId) => TOOL_ID_PATTERN.test(toolId)),
		),
	);
}

export function readToolIds(value: unknown): string[] | null {
	if (Array.isArray(value)) {
		return normaliseToolIds(value.filter((toolId): toolId is string => typeof toolId === "string"));
	}

	if (typeof value === "string" && value.trim().length > 0) {
		try {
			const parsed = JSON.parse(value);
			if (Array.isArray(parsed)) {
				return normaliseToolIds(
					parsed.filter((toolId): toolId is string => typeof toolId === "string"),
				);
			}
		} catch {
			return normaliseToolIds(value);
		}
	}

	return null;
}

export function mergeToolIds(currentTools: string[], toolId: string): string[] {
	return normaliseToolIds([...currentTools, toolId]);
}
