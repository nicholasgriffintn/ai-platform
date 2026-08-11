import z from "zod/v4";
import { addProjectCapabilitySchema, createProjectSchema } from "./workspaces";

export const templateKindSchema = z.enum(["project", "recipe", "capability"]);
export const templateStatusSchema = z.enum(["active", "paused", "archived"]);

export const templateSchema = z.object({
	id: z.string(),
	createdByUserId: z.number().int().positive(),
	workspaceId: z.string().nullable(),
	kind: templateKindSchema,
	capabilityId: z.string().nullable(),
	name: z.string(),
	description: z.string(),
	configuration: z.record(z.string(), z.unknown()),
	status: templateStatusSchema,
	createdAt: z.string(),
	updatedAt: z.string().nullable(),
});

export const templateListQuerySchema = z.object({
	workspaceId: z.string().min(1).optional(),
	kind: templateKindSchema.optional(),
});

export const createTemplateSchema = z.object({
	workspaceId: z.string().min(1).nullable().optional(),
	kind: templateKindSchema,
	capabilityId: z.string().min(1).nullable().optional(),
	name: z.string().trim().min(1).max(120),
	description: z.string().trim().max(500).default(""),
	configuration: z.record(z.string(), z.unknown()).default({}),
	status: templateStatusSchema.default("active"),
});

export const updateTemplateSchema = z
	.object({
		name: z.string().trim().min(1).max(120).optional(),
		description: z.string().trim().max(500).optional(),
		configuration: z.record(z.string(), z.unknown()).optional(),
		status: templateStatusSchema.optional(),
	})
	.refine((value) => Object.keys(value).length > 0, { error: "Provide a template change" });

export const templateListResponseSchema = z.object({ templates: z.array(templateSchema) });

export const projectTemplateConfigurationSchema = z.object({
	project: createProjectSchema,
	capabilities: z.array(addProjectCapabilitySchema).max(100).default([]),
});

export const instantiateProjectTemplateSchema = z.object({
	workspaceId: z.string().min(1),
	name: z.string().trim().min(2).max(100).optional(),
});

export type Template = z.infer<typeof templateSchema>;
export type TemplateKind = z.infer<typeof templateKindSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type ProjectTemplateConfiguration = z.infer<typeof projectTemplateConfigurationSchema>;
