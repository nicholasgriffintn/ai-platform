import z from "zod/v4";

import rawConfiguredComposioToolkits from "./configured-toolkit-manifest.generated.json";

const authConfigSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	authScheme: z.string().min(1),
	isManaged: z.boolean(),
	operationIds: z.array(z.string().min(1)).optional(),
});

const toolkitSchema = z
	.object({
		providerId: z.string().min(1),
		name: z.string().min(1),
		description: z.string().min(1),
		logoUrl: z.url(),
		appUrl: z.url().optional(),
		categories: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) })),
		authConfigs: z.array(authConfigSchema).min(1),
		toolkitSlug: z.string().min(1),
		toolkitVersion: z.string().regex(/^\d{8}_\d{2}$/),
		toolCount: z.number().int().nonnegative(),
		readToolCount: z.number().int().nonnegative(),
		writeToolCount: z.number().int().nonnegative(),
		scopes: z.array(z.string()),
		operations: z.object({
			read: z.array(z.string().min(1)),
			write: z.array(z.string().min(1)),
			important: z.array(z.string().min(1)),
		}),
	})
	.transform((toolkit) => {
		const important = new Set(toolkit.operations.important);
		const defaultAuthConfigIds = toolkit.authConfigs.map((config) => config.id);
		const toOperation = (id: string, access: "read" | "write") => ({
			id,
			access,
			isImportant: important.has(id),
			authConfigIds: toolkit.authConfigs.some((config) => config.operationIds)
				? toolkit.authConfigs
						.filter((config) => config.operationIds?.includes(id))
						.map((config) => config.id)
				: defaultAuthConfigIds,
		});
		return {
			...toolkit,
			authConfigs: toolkit.authConfigs.map(({ operationIds: _operationIds, ...config }) => config),
			operations: [
				...toolkit.operations.read.map((id) => toOperation(id, "read")),
				...toolkit.operations.write.map((id) => toOperation(id, "write")),
			].sort((left, right) => left.id.localeCompare(right.id)),
		};
	});

export const configuredComposioToolkits = z
	.record(z.string(), toolkitSchema)
	.parse(rawConfiguredComposioToolkits);
