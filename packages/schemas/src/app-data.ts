import z from "zod/v4";

export const appDataSchema = z.object({
	id: z.string(),
	user_id: z.number(),
	app_id: z.string(),
	item_id: z.string().optional(),
	item_type: z.string().optional(),
	data: z.string(),
	share_id: z.string().optional(),
	created_at: z.string(),
	updated_at: z.string(),
});
