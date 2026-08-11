import z from "zod/v4";

export const workspaceAuditRecordSchema = z.object({
	id: z.string(),
	workspaceId: z.string(),
	actorUserId: z.number().int().positive().nullable(),
	action: z.string(),
	targetType: z.string(),
	targetId: z.string().nullable(),
	metadata: z.record(z.string(), z.unknown()),
	createdAt: z.string(),
});

export const workspaceAuditListQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(200).default(50),
	after: z.string().optional(),
});

export const workspaceAuditListResponseSchema = z.object({
	records: z.array(workspaceAuditRecordSchema),
});

export type WorkspaceAuditRecord = z.infer<typeof workspaceAuditRecordSchema>;
