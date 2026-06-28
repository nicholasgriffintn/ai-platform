export function normaliseAssistantCapabilityTags(tags: readonly (string | undefined)[]): string[] {
	const normalisedTags = new Set<string>();

	for (const tag of tags) {
		const normalised = tag
			?.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");

		if (normalised) {
			normalisedTags.add(normalised);
		}
	}

	return [...normalisedTags];
}
