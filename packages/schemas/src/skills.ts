import z from "zod/v4";

export const SKILL_LOAD_TOOL_NAME = "load_skill";

export const skillCategorySchema = z.enum([
	"Output",
	"Automation",
	"Research",
	"Development",
	"Communication",
	"Data",
	"Other",
]);

export const skillRequirementSchema = z.object({
	modelCapabilities: z.array(z.string()).default([]),
	tools: z.array(z.string()).default([]),
});

export const skillSourceSchema = z.enum(["built-in", "user-authored"]);

export const skillIdSchema = z
	.string()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Skill ids are kebab-case")
	.max(64);

export const skillResourceSummarySchema = z.object({
	path: z.string().min(1).max(512),
	kind: z.enum(["reference", "script", "asset", "file"]),
	size: z.number().int().nonnegative().optional(),
	encoding: z.enum(["text", "base64"]).optional(),
	mimeType: z.string().min(1).optional(),
});

export const skillSummarySchema = z.object({
	id: skillIdSchema,
	name: z.string().min(1).max(80),
	description: z.string().min(1).max(1024),
	category: skillCategorySchema,
	tags: z.array(z.string()).default([]),
	alwaysOn: z.boolean().default(false),
	requirement: skillRequirementSchema,
	source: skillSourceSchema.optional(),
});

export const skillAvailabilityStateSchema = z.enum(["ready", "disabled", "unavailable"]);

export const skillAvailabilitySchema = skillSummarySchema.extend({
	state: skillAvailabilityStateSchema,
	reason: z.string().min(1),
});

export const skillAvailabilityResponseSchema = z.object({
	skills: z.array(skillAvailabilitySchema),
});

export const setSkillEnabledSchema = z.object({
	enabled: z.boolean(),
});

export const authoredSkillInputSchema = z.object({
	content: z
		.string()
		.min(1)
		.max(128 * 1024),
});

export const authoredSkillScopeSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("personal") }),
	z.object({ type: z.literal("project"), projectId: z.string().min(1) }),
]);

export const authoredSkillSchema = z.object({
	id: z.string().min(1),
	name: skillIdSchema,
	description: z.string().min(1).max(1024),
	scope: authoredSkillScopeSchema,
	createdByUserId: z.number().int().positive(),
	createdAt: z.string(),
	updatedAt: z.string().nullable(),
});

export const authoredSkillDocumentSchema = authoredSkillSchema.extend({
	content: z.string().min(1),
});

export const authoredSkillListResponseSchema = z.object({
	skills: z.array(authoredSkillSchema),
});

export const loadSkillInputSchema = z.object({
	skill: skillIdSchema.describe("The name of the skill to load, exactly as listed."),
	resource: z
		.string()
		.min(1)
		.max(512)
		.optional()
		.describe("Optional relative resource path from the skill to load instead of SKILL.md."),
});

export type SkillCategory = z.infer<typeof skillCategorySchema>;
export type SkillRequirement = z.infer<typeof skillRequirementSchema>;
export type SkillSource = z.infer<typeof skillSourceSchema>;
export type SkillResourceSummary = z.infer<typeof skillResourceSummarySchema>;
export type SkillSummary = z.infer<typeof skillSummarySchema>;
export type SkillAvailabilityState = z.infer<typeof skillAvailabilityStateSchema>;
export type SkillAvailability = z.infer<typeof skillAvailabilitySchema>;
export type SkillAvailabilityResponse = z.infer<typeof skillAvailabilityResponseSchema>;
export type SetSkillEnabledInput = z.infer<typeof setSkillEnabledSchema>;
export type AuthoredSkillInput = z.infer<typeof authoredSkillInputSchema>;
export type AuthoredSkillScope = z.infer<typeof authoredSkillScopeSchema>;
export type AuthoredSkill = z.infer<typeof authoredSkillSchema>;
export type AuthoredSkillDocument = z.infer<typeof authoredSkillDocumentSchema>;
export type LoadSkillInput = z.infer<typeof loadSkillInputSchema>;
