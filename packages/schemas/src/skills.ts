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

export const skillResourceSummarySchema = z.object({
	path: z.string().min(1).max(512),
	kind: z.enum(["reference", "script", "asset", "file"]),
	size: z.number().int().nonnegative().optional(),
	encoding: z.enum(["text", "base64"]).optional(),
	mimeType: z.string().min(1).optional(),
});

export const skillSummarySchema = z.object({
	id: z
		.string()
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Skill ids are kebab-case")
		.max(64),
	name: z.string().min(1).max(80),
	description: z.string().min(1).max(1024),
	category: skillCategorySchema,
	tags: z.array(z.string()).default([]),
	alwaysOn: z.boolean().default(false),
	requirement: skillRequirementSchema,
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

export const loadSkillInputSchema = z.object({
	skill: z.string().min(1).max(64).describe("The name of the skill to load, exactly as listed."),
	resource: z
		.string()
		.min(1)
		.max(512)
		.optional()
		.describe("Optional relative resource path from the skill to load instead of SKILL.md."),
});

export type SkillCategory = z.infer<typeof skillCategorySchema>;
export type SkillRequirement = z.infer<typeof skillRequirementSchema>;
export type SkillResourceSummary = z.infer<typeof skillResourceSummarySchema>;
export type SkillSummary = z.infer<typeof skillSummarySchema>;
export type SkillAvailabilityState = z.infer<typeof skillAvailabilityStateSchema>;
export type SkillAvailability = z.infer<typeof skillAvailabilitySchema>;
export type SkillAvailabilityResponse = z.infer<typeof skillAvailabilityResponseSchema>;
export type SetSkillEnabledInput = z.infer<typeof setSkillEnabledSchema>;
export type LoadSkillInput = z.infer<typeof loadSkillInputSchema>;
