import type { AssistantCapabilityDescriptor, DynamicAppCatalogItem } from "@assistant/schemas";

import { normaliseAssistantCapabilityTags } from "~/services/assistant-capabilities";

type DynamicAppCapabilitySource = Pick<
	DynamicAppCatalogItem,
	"id" | "name" | "description" | "href" | "kind" | "tags"
>;

export function createDynamicAppCapabilityDescriptor(
	app: DynamicAppCapabilitySource,
): AssistantCapabilityDescriptor {
	const kind = app.kind ?? (app.href ? "frontend" : "dynamic");
	if (kind === "frontend") {
		return {
			id: app.id,
			kind: "frontend_app",
			name: app.name,
			description: app.description,
			availability: "available",
			launch: {
				method: "navigation",
				href: app.href,
			},
			executionMode: "navigation",
			authRequirement: "none",
			savedState: {
				supported: false,
			},
			tags: normaliseAssistantCapabilityTags(app.tags ?? []),
		};
	}

	return {
		id: app.id,
		kind: "dynamic_app",
		name: app.name,
		description: app.description,
		availability: "available",
		launch: {
			method: "form",
		},
		executionMode: "function",
		authRequirement: "none",
		savedState: {
			supported: true,
			kind: "stored_response",
		},
		tags: normaliseAssistantCapabilityTags(app.tags ?? []),
	};
}
