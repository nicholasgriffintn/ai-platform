import { quoteForShell } from "../commands";

import {
	MAX_CONTEXT_FILES,
	MAX_CONTEXT_SNIPPET_LINES,
	MAX_INSTRUCTION_FILES,
	MAX_READ_FILE_LINES,
	MAX_SNIPPET_CHARS,
} from "./constants";
import type {
	FileContextSnippet,
	ReadFileResult,
	RalphPrdContext,
	RalphPrdUserStory,
	RepositoryContext,
	SandboxInstance,
} from "./types";
import {
	extractRelativePath,
	formatStoryLabel,
	isObjectRecord,
	normaliseRepoRelativePath,
	parsePriority,
	parsePositiveInteger,
	toPrioritySortValue,
	truncateForModel,
} from "./utils";

const PRD_FILE_PATH_PATTERNS: RegExp[] = [
	/^prd\.json$/i,
	/^prd\.md$/i,
	/^docs\/prd\.md$/i,
	/^tasks\/prd-[^/]+\.md$/i,
	/\/tasks\/prd-[^/]+\.md$/i,
];

const IMPLEMENT_FILE_PATH_PATTERNS: RegExp[] = [/^\.implement(?:\.md)?$/i];

function discoverRepoFiles(params: {
	sandbox: SandboxInstance;
	repoTargetDir: string;
	findExpression: string;
	maxFiles: number;
}): Promise<string[]> {
	const { sandbox, repoTargetDir, findExpression, maxFiles } = params;
	return sandbox
		.exec(
			`find ${quoteForShell(repoTargetDir)} -maxdepth 4 -type f ${findExpression} | sort`,
		)
		.then((result) => {
			if (!result.success) {
				return [];
			}

			return result.stdout
				.split("\n")
				.map((entry) => extractRelativePath(repoTargetDir, entry.trim()))
				.filter(Boolean)
				.slice(0, maxFiles);
		});
}

export function isPrdInstructionPath(path: string): boolean {
	const normalisedPath = path.trim().replace(/^\.\//, "").toLowerCase();
	if (!normalisedPath) {
		return false;
	}

	return PRD_FILE_PATH_PATTERNS.some((pattern) => pattern.test(normalisedPath));
}

export function isImplementInstructionPath(path: string): boolean {
	const normalisedPath = path.trim().replace(/^\.\//, "").toLowerCase();
	if (!normalisedPath) {
		return false;
	}

	return IMPLEMENT_FILE_PATH_PATTERNS.some((pattern) =>
		pattern.test(normalisedPath),
	);
}

interface RawRalphPrdUserStory {
	id?: unknown;
	title?: unknown;
	description?: unknown;
	priority?: unknown;
	passes?: unknown;
	acceptanceCriteria?: unknown;
}

function normaliseRalphPrdUserStory(
	rawStory: RawRalphPrdUserStory,
	index: number,
): RalphPrdUserStory {
	const id =
		typeof rawStory.id === "string" && rawStory.id.trim()
			? rawStory.id.trim()
			: undefined;
	const title =
		typeof rawStory.title === "string" && rawStory.title.trim()
			? rawStory.title.trim()
			: "Untitled story";
	const description =
		typeof rawStory.description === "string" && rawStory.description.trim()
			? rawStory.description.trim()
			: "No description";
	const priority = parsePriority(rawStory.priority);
	const acceptanceCriteria = Array.isArray(rawStory.acceptanceCriteria)
		? rawStory.acceptanceCriteria
				.filter((item): item is string => typeof item === "string")
				.map((item) => item.trim())
				.filter(Boolean)
		: [];

	return {
		index,
		id,
		title,
		description,
		priority,
		passes: rawStory.passes === true,
		acceptanceCriteria,
	};
}

export function parseRalphPrdContext(
	path: string,
	rawJson: string,
): RalphPrdContext | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(rawJson) as Record<string, unknown>;
	} catch {
		return null;
	}

	if (!isObjectRecord(parsed)) {
		return null;
	}

	const project =
		typeof parsed.project === "string" && parsed.project.trim()
			? parsed.project.trim()
			: undefined;
	const description =
		typeof parsed.description === "string" && parsed.description.trim()
			? parsed.description.trim()
			: undefined;

	const userStoriesRaw = Array.isArray(parsed.userStories)
		? parsed.userStories
		: [];

	const userStories = userStoriesRaw.flatMap((story, index) => {
		if (!isObjectRecord(story)) {
			return [];
		}

		return [normaliseRalphPrdUserStory(story, index)];
	});

	return {
		path,
		project,
		description,
		userStories,
	};
}

export function summariseRalphPrdContext(prdContext: RalphPrdContext): string {
	const project = prdContext.project || "Unnamed project";
	const description = prdContext.description;
	const { userStories } = prdContext;

	if (userStories.length === 0) {
		return [
			"Ralph PRD summary:",
			`Project: ${project}`,
			description ? `Description: ${description}` : "",
			"No user stories were found in prd.json.",
		]
			.filter(Boolean)
			.join("\n");
	}

	const pendingStories = userStories
		.filter((story) => story.passes !== true)
		.sort(
			(a, b) =>
				toPrioritySortValue(a.priority) - toPrioritySortValue(b.priority),
		);
	const selectedStories = (pendingStories.length ? pendingStories : userStories)
		.slice(0, 8)
		.map((story) => {
			const priorityText =
				typeof story.priority === "number" && Number.isFinite(story.priority)
					? `priority ${story.priority}`
					: "no priority";
			const statusText = story.passes === true ? "passes=true" : "passes=false";

			const storyLabel = formatStoryLabel(story);
			return `- ${storyLabel} (${priorityText}, ${statusText}): ${story.description}`;
		});

	return [
		"Ralph PRD summary:",
		`Project: ${project}`,
		description ? `Description: ${description}` : "",
		pendingStories.length
			? "Pending user stories (passes=false):"
			: "User stories:",
		...selectedStories,
	]
		.filter(Boolean)
		.join("\n");
}

export function summariseRalphPrdJson(rawJson: string): string | null {
	const parsed = parseRalphPrdContext("prd.json", rawJson);
	if (!parsed) {
		return null;
	}

	return summariseRalphPrdContext(parsed);
}

function normaliseTaskInstructionSnippet(
	entry: FileContextSnippet,
	prdContext?: RalphPrdContext,
): FileContextSnippet {
	if (entry.path.toLowerCase().endsWith("prd.json") && prdContext) {
		const prdSummary = summariseRalphPrdContext(prdContext);
		if (prdSummary) {
			return {
				path: entry.path,
				snippet: truncateForModel(prdSummary, MAX_SNIPPET_CHARS),
			};
		}
	}

	return {
		path: entry.path,
		snippet: truncateForModel(entry.snippet, MAX_SNIPPET_CHARS),
	};
}

async function loadRalphPrdContextForPath(params: {
	sandbox: SandboxInstance;
	repoTargetDir: string;
	path: string;
	snippet: string;
}): Promise<RalphPrdContext | undefined> {
	const { sandbox, repoTargetDir, path, snippet } = params;
	if (!path.toLowerCase().endsWith("prd.json")) {
		return undefined;
	}

	const absolutePath = `${repoTargetDir}/${path}`;
	const fullFileResult = await sandbox.readFile(absolutePath);
	if (
		fullFileResult.success &&
		typeof fullFileResult.content === "string" &&
		fullFileResult.content.trim()
	) {
		const parsed = parseRalphPrdContext(path, fullFileResult.content);
		if (parsed) {
			return parsed;
		}
	}

	return parseRalphPrdContext(path, snippet) ?? undefined;
}

export async function readRepositoryFileSnippet(params: {
	sandbox: SandboxInstance;
	repoTargetDir: string;
	path: string;
	startLine?: number;
	endLine?: number;
}): Promise<ReadFileResult> {
	const { sandbox, repoTargetDir } = params;
	const path = normaliseRepoRelativePath(params.path);
	const startLine = parsePositiveInteger(
		params.startLine,
		1,
		Number.MAX_SAFE_INTEGER,
	);
	const requestedEndLine = parsePositiveInteger(
		params.endLine,
		startLine + MAX_READ_FILE_LINES - 1,
		Number.MAX_SAFE_INTEGER,
	);
	const boundedEndLine = Math.min(
		Math.max(startLine, requestedEndLine),
		startLine + MAX_READ_FILE_LINES - 1,
	);
	const targetPath = `${repoTargetDir}/${path}`;
	const result = await sandbox.exec(
		`sed -n "${startLine},${boundedEndLine}p" ${quoteForShell(targetPath)}`,
	);

	if (!result.success) {
		return {
			path,
			startLine,
			endLine: boundedEndLine,
			content: "",
			truncated: false,
			error: result.stderr || result.stdout || "Unable to read file",
		};
	}

	const trimmedContent = result.stdout.trim();
	const truncated = trimmedContent.length > MAX_SNIPPET_CHARS;

	return {
		path,
		startLine,
		endLine: boundedEndLine,
		content: truncateForModel(trimmedContent, MAX_SNIPPET_CHARS),
		truncated,
	};
}

export async function collectRepositoryContext(params: {
	sandbox: SandboxInstance;
	repoTargetDir: string;
}): Promise<RepositoryContext> {
	const { sandbox, repoTargetDir } = params;
	const topLevelResult = await sandbox.exec(
		`ls -1 ${quoteForShell(repoTargetDir)}`,
	);
	const topLevelEntries = topLevelResult.success
		? topLevelResult.stdout
				.split("\n")
				.map((entry) => entry.trim())
				.filter(Boolean)
				.slice(0, 80)
		: [];

	const contextPaths = await discoverRepoFiles({
		sandbox,
		repoTargetDir,
		findExpression:
			"\\( -name 'README.md' -o -name 'README' -o -name 'package.json' -o " +
			"-name 'pnpm-workspace.yaml' -o -name 'tsconfig.json' -o -name 'pyproject.toml' -o " +
			"-name 'Cargo.toml' -o -name 'go.mod' -o -name 'requirements.txt' \\)",
		maxFiles: MAX_CONTEXT_FILES,
	});

	const instructionPaths = await discoverRepoFiles({
		sandbox,
		repoTargetDir,
		findExpression:
			"\\( -name 'prd.json' -o -name 'PRD.md' -o -name 'prd.md' -o " +
			"-path '*/tasks/prd-*.md' -o -name '.implement' -o -name '.implement.md' \\)",
		maxFiles: MAX_INSTRUCTION_FILES,
	});

	const files: FileContextSnippet[] = [];
	const prdInstructions: FileContextSnippet[] = [];
	const implementInstructions: FileContextSnippet[] = [];
	let prdContext: RalphPrdContext | undefined;

	for (const candidatePath of contextPaths) {
		const snippetResult = await readRepositoryFileSnippet({
			sandbox,
			repoTargetDir,
			path: candidatePath,
			startLine: 1,
			endLine: MAX_CONTEXT_SNIPPET_LINES,
		});
		if (snippetResult.error || !snippetResult.content.trim()) {
			continue;
		}

		files.push({
			path: snippetResult.path,
			snippet: snippetResult.content,
		});
	}

	for (const candidatePath of instructionPaths) {
		const snippetResult = await readRepositoryFileSnippet({
			sandbox,
			repoTargetDir,
			path: candidatePath,
			startLine: 1,
			endLine: MAX_CONTEXT_SNIPPET_LINES,
		});
		if (snippetResult.error || !snippetResult.content.trim()) {
			continue;
		}

		const parsedPrdContext = await loadRalphPrdContextForPath({
			sandbox,
			repoTargetDir,
			path: snippetResult.path,
			snippet: snippetResult.content,
		});
		const contextEntry = normaliseTaskInstructionSnippet(
			{
				path: snippetResult.path,
				snippet: snippetResult.content,
			},
			parsedPrdContext,
		);

		if (isPrdInstructionPath(contextEntry.path)) {
			if (!prdContext && parsedPrdContext) {
				prdContext = parsedPrdContext;
			}
			prdInstructions.push(contextEntry);
			continue;
		}
		if (isImplementInstructionPath(contextEntry.path)) {
			implementInstructions.push(contextEntry);
		}
	}

	if (prdInstructions.length > 0) {
		return {
			topLevelEntries,
			files,
			taskInstructions: prdInstructions[0],
			taskInstructionSource: "prd",
			prdContext,
		};
	}

	if (implementInstructions.length > 0) {
		return {
			topLevelEntries,
			files,
			taskInstructions: implementInstructions[0],
			taskInstructionSource: "implement",
		};
	}

	return {
		topLevelEntries,
		files,
		taskInstructionSource: "none",
	};
}
