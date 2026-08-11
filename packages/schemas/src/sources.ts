import z from "zod/v4";

export const sourceKindSchema = z.enum([
	"file",
	"memory",
	"text",
	"url",
	"connector",
	"repository",
]);
export const sourceStatusSchema = z.enum(["processing", "available", "failed", "archived"]);
export const sourceScopeSchema = z.enum(["personal", "project"]);

export const sourceFileSchema = z
	.object({
		key: z.string().min(1).max(1024),
		mimeType: z.string().min(1).max(255),
		filename: z.string().max(255).nullable(),
		byteSize: z.number().int().nonnegative().nullable(),
	})
	.strict();

export const sourceSchema = z
	.object({
		id: z.string().min(1),
		createdByUserId: z.number().int().positive(),
		projectId: z.string().nullable(),
		conversationId: z.string().nullable(),
		connectionId: z.string().nullable(),
		kind: sourceKindSchema,
		title: z.string().trim().min(1).max(200),
		status: sourceStatusSchema,
		content: z.string().nullable(),
		provider: z.string().max(100).nullable(),
		externalUri: z.string().max(2048).nullable(),
		vectorId: z.string().max(255).nullable(),
		metadata: z.record(z.string(), z.unknown()),
		file: sourceFileSchema.nullable(),
		createdAt: z.string(),
		updatedAt: z.string().nullable(),
	})
	.strict();

export const sourceSummarySchema = sourceSchema.omit({ content: true });

export const createSourceSchema = z
	.object({
		projectId: z.string().min(1).nullable().optional(),
		conversationId: z.string().min(1).nullable().optional(),
		connectionId: z.string().min(1).nullable().optional(),
		kind: sourceKindSchema,
		title: z.string().trim().min(1).max(200),
		status: sourceStatusSchema.default("available"),
		content: z.string().max(500_000).nullable().optional(),
		provider: z.string().trim().min(1).max(100).nullable().optional(),
		externalUri: z.url().max(2048).nullable().optional(),
		vectorId: z.string().trim().min(1).max(255).nullable().optional(),
		metadata: z.record(z.string(), z.unknown()).default({}),
		file: sourceFileSchema.nullable().optional(),
	})
	.strict();

export const updateSourceSchema = z
	.object({
		title: z.string().trim().min(1).max(200).optional(),
		status: sourceStatusSchema.optional(),
		content: z.string().max(500_000).nullable().optional(),
		metadata: z.record(z.string(), z.unknown()).optional(),
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, {
		error: "At least one source field must be provided",
	});

export const sourceListResponseSchema = z
	.object({ sources: z.array(sourceSummarySchema) })
	.strict();

export const sourceListQuerySchema = z
	.object({
		projectId: z.string().min(1).optional(),
		kind: sourceKindSchema.optional(),
	})
	.strict();

export const sourceCollectionSchema = z
	.object({
		id: z.string().min(1),
		createdByUserId: z.number().int().positive(),
		projectId: z.string().nullable(),
		title: z.string().min(1).max(120),
		description: z.string().max(500).nullable(),
		kind: z.enum(["general", "memory"]),
		sourceCount: z.number().int().nonnegative(),
		createdAt: z.string(),
		updatedAt: z.string().nullable(),
	})
	.strict();

export const createSourceCollectionSchema = z
	.object({
		projectId: z.string().min(1).nullable().optional(),
		title: z.string().trim().min(1).max(120),
		description: z.string().trim().max(500).nullable().optional(),
		kind: z.enum(["general", "memory"]).default("general"),
	})
	.strict();

export const sourceCollectionListResponseSchema = z
	.object({ collections: z.array(sourceCollectionSchema) })
	.strict();

export const addCollectionSourcesSchema = z
	.object({ sourceIds: z.array(z.string().min(1)).min(1).max(100) })
	.strict();

export const providerConnectionSummarySchema = z
	.object({
		id: z.string().min(1),
		provider: z.string().min(1).max(100),
		kind: z.string().min(1).max(80),
		externalId: z.string().max(200).nullable(),
		status: z.enum(["connected", "invalid", "revoked"]),
		metadata: z.record(z.string(), z.unknown()),
		createdAt: z.string(),
		updatedAt: z.string().nullable(),
	})
	.strict();

export type SourceKind = z.infer<typeof sourceKindSchema>;
export type SourceStatus = z.infer<typeof sourceStatusSchema>;
export type SourceFile = z.infer<typeof sourceFileSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type SourceSummary = z.infer<typeof sourceSummarySchema>;
export type CreateSourceInput = z.infer<typeof createSourceSchema>;
export type UpdateSourceInput = z.infer<typeof updateSourceSchema>;
export type SourceCollection = z.infer<typeof sourceCollectionSchema>;
export type CreateSourceCollectionInput = z.infer<typeof createSourceCollectionSchema>;
export type ProviderConnectionSummary = z.infer<typeof providerConnectionSummarySchema>;
