import {
	skillCategorySchema,
	type SkillCategory,
	type SkillSummary,
} from "@ngriffin_uk/polychat-schemas";

const METADATA_KEYS = {
	displayName: "polychat-display-name",
	category: "polychat-category",
	tags: "polychat-tags",
	alwaysOn: "polychat-always-on",
	modelCapabilities: "polychat-model-capabilities",
	tools: "polychat-tools",
} as const;

export type SkillResourceKind = "reference" | "script" | "asset" | "file";

export interface SkillResourceDescriptor {
	path: string;
	kind: SkillResourceKind;
	size?: number;
	encoding?: "text" | "base64";
	mimeType?: string;
}

export interface SkillResource extends SkillResourceDescriptor {
	content: string;
}

export interface SkillDescriptor {
	name: string;
	description: string;
	compatibility?: string;
	license?: string;
	allowedTools?: string;
	metadata?: Record<string, string>;
}

export interface SkillContent extends SkillDescriptor {
	body: string;
	resources?: SkillResourceDescriptor[];
}

export interface SkillDefinition {
	id: string;
	name: string;
	description: string;
	category: SkillCategory;
	tags: string[];
	alwaysOn: boolean;
	requirement: {
		modelCapabilities: string[];
		tools: string[];
	};
}

function readMetadataString(
	descriptor: SkillDescriptor,
	key: (typeof METADATA_KEYS)[keyof typeof METADATA_KEYS],
): string | undefined {
	const value = descriptor.metadata?.[key];
	if (value === undefined) return undefined;
	return value.trim() || undefined;
}

function readMetadataList(
	descriptor: SkillDescriptor,
	key: (typeof METADATA_KEYS)[keyof typeof METADATA_KEYS],
): string[] {
	const value = readMetadataString(descriptor, key);
	if (!value) return [];
	return [
		...new Set(
			value
				.split(",")
				.map((item) => item.trim())
				.filter(Boolean),
		),
	];
}

function readCategory(descriptor: SkillDescriptor): SkillCategory {
	const value = readMetadataString(descriptor, METADATA_KEYS.category) ?? "Other";
	const category = skillCategorySchema.safeParse(value);
	if (!category.success) {
		throw new Error(`Skill ${descriptor.name} has unsupported Polychat category ${value}`);
	}
	return category.data;
}

function readAlwaysOn(descriptor: SkillDescriptor): boolean {
	const value = readMetadataString(descriptor, METADATA_KEYS.alwaysOn);
	if (value === undefined || value === "false") return false;
	if (value === "true") return true;
	throw new Error(
		`Skill ${descriptor.name} metadata ${METADATA_KEYS.alwaysOn} must be true or false`,
	);
}

export function toSkillDefinition(
	descriptor: SkillDescriptor,
	options: { allowAlwaysOn?: boolean } = {},
): SkillDefinition {
	return {
		id: descriptor.name,
		name: readMetadataString(descriptor, METADATA_KEYS.displayName) ?? descriptor.name,
		description: descriptor.description,
		category: readCategory(descriptor),
		tags: readMetadataList(descriptor, METADATA_KEYS.tags),
		alwaysOn: options.allowAlwaysOn === true && readAlwaysOn(descriptor),
		requirement: {
			modelCapabilities: [
				...new Set([
					"supportsToolCalls",
					...readMetadataList(descriptor, METADATA_KEYS.modelCapabilities),
				]),
			],
			tools: readMetadataList(descriptor, METADATA_KEYS.tools),
		},
	};
}

export function toSkillSummary(skill: SkillDefinition): SkillSummary {
	return {
		id: skill.id,
		name: skill.name,
		description: skill.description,
		category: skill.category,
		tags: skill.tags,
		alwaysOn: skill.alwaysOn,
		requirement: skill.requirement,
	};
}
