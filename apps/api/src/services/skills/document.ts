import z from "zod/v4";
import { parse as parseYaml } from "yaml";

const skillNameSchema = z
	.string()
	.min(1)
	.max(64)
	.regex(
		/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
		"must contain only lowercase letters, numbers, and single hyphens",
	);

export const agentSkillFrontmatterSchema = z
	.object({
		name: skillNameSchema,
		description: z.string().trim().min(1).max(1024),
		license: z.string().trim().min(1).optional(),
		compatibility: z.string().trim().min(1).max(500).optional(),
		metadata: z.record(z.string(), z.string()).optional(),
		"allowed-tools": z.string().trim().min(1).optional(),
	})
	.strict();

export type AgentSkillFrontmatter = z.infer<typeof agentSkillFrontmatterSchema>;

export interface ParsedSkillDocument {
	frontmatter: AgentSkillFrontmatter;
	body: string;
}

export class SkillDocumentError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SkillDocumentError";
	}
}

export function validateSkillResourcePath(path: string): string | null {
	if (path.length > 512) {
		return "Skill resource path must be 512 characters or fewer";
	}
	if (/\p{Cc}/u.test(path)) {
		return "Skill resource path must not contain control characters";
	}
	if (
		path.startsWith("/") ||
		path.includes("\\") ||
		path.includes("\0") ||
		path.split("/").some((part) => part === "" || part === "." || part === "..")
	) {
		return `Skill resource path must be a normalised relative path: ${path}`;
	}
	return null;
}

export function parseSkillDocument(
	rawContent: string,
	directoryName?: string,
): ParsedSkillDocument {
	const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
	if (!match) {
		throw new SkillDocumentError("SKILL.md must start with YAML frontmatter");
	}

	let yaml: unknown;
	try {
		yaml = parseYaml(match[1] ?? "");
	} catch (error) {
		throw new SkillDocumentError(
			`SKILL.md contains invalid YAML: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	const parsed = agentSkillFrontmatterSchema.safeParse(yaml);
	if (!parsed.success) {
		throw new SkillDocumentError(
			`SKILL.md frontmatter is invalid: ${parsed.error.issues
				.map((issue) => `${issue.path.join(".") || "root"} ${issue.message}`)
				.join(", ")}`,
		);
	}

	if (directoryName && parsed.data.name !== directoryName) {
		throw new SkillDocumentError(
			`Skill name ${parsed.data.name} must match its directory ${directoryName}`,
		);
	}

	const body = (match[2] ?? "").trim();
	if (!body) {
		throw new SkillDocumentError("SKILL.md must contain instructions after its frontmatter");
	}

	return { frontmatter: parsed.data, body };
}
