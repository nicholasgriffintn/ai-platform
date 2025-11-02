import z from "zod/v4";

export const memoryListResponseSchema = z.object({
	memories: z.array(
		z.object({
			id: z.string(),
			text: z.string(),
			category: z.string(),
			created_at: z.string(),
			group_id: z.string().nullable(),
			group_title: z.string().nullable(),
		}),
	),
	groups: z.array(
		z.object({
			id: z.string(),
			title: z.string(),
			description: z.string().nullable(),
			category: z.string().nullable(),
			member_count: z.number(),
			created_at: z.string(),
		}),
	),
});

export const memoryGroupResponseSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string().nullable(),
	category: z.string().nullable(),
	created_at: z.string(),
});

export const memoryGroupCreateSchema = z.object({
	title: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
	category: z
		.enum(["fact", "preference", "schedule", "general", "snapshot"])
		.optional(),
});

export const memoryGroupAddSchema = z.object({
	memory_ids: z.array(z.string()).min(1),
});

export const memoryOperationResponseSchema = z.object({
	success: z.boolean(),
	added_count: z.number().optional(),
	deleted_from_groups: z.number().optional(),
});
