import {
	modelToolIdSchema,
	type ModelToolId,
	type SavedToolConfiguration,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { CapabilityConfigurationScope } from "~/repositories/CapabilityConfigurationRepository";
import { validateModelToolConfiguration } from "./modelToolConfiguration";

export async function listModelToolConfigurations(
	context: ServiceContext,
	scope: CapabilityConfigurationScope,
): Promise<{ configurations: SavedToolConfiguration[] }> {
	const records = await context.repositories.capabilityConfigurations.list(scope, "tool");
	return {
		configurations: records.flatMap((record) => {
			const toolId = modelToolIdSchema.safeParse(record.capabilityId);
			return toolId.success
				? [
						{
							toolId: toolId.data,
							configuration: record.configuration,
							createdAt: record.createdAt,
							updatedAt: record.updatedAt,
						},
					]
				: [];
		}),
	};
}

export async function saveModelToolConfiguration(
	context: ServiceContext,
	scope: CapabilityConfigurationScope,
	toolId: ModelToolId,
	configuration: Record<string, unknown>,
): Promise<SavedToolConfiguration> {
	const validated = validateModelToolConfiguration(toolId, configuration);
	const record = await context.repositories.capabilityConfigurations.save({
		scope,
		capabilityKind: "tool",
		capabilityId: toolId,
		configuration: validated,
	});
	return {
		toolId,
		configuration: record.configuration,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
	};
}
