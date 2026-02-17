import type {
	RalphPrdContext,
	RalphPrdUserStory,
	SandboxFileInstance,
} from "./types";
import {
	escapeRegExp,
	formatStoryLabel,
	isObjectRecord,
	toPrioritySortValue,
} from "./utils";

function scoreStoryAgainstText(story: RalphPrdUserStory, text: string): number {
	const normalisedText = text.toLowerCase();
	let score = 0;

	if (story.id) {
		const idPattern = new RegExp(`\\b${escapeRegExp(story.id)}\\b`, "i");
		if (idPattern.test(text)) {
			score += 5;
		}
	}

	const title = story.title.trim();
	if (title && normalisedText.includes(title.toLowerCase())) {
		score += 4;
	}

	for (const token of title.split(/\s+/)) {
		if (token.length < 4) {
			continue;
		}
		if (normalisedText.includes(token.toLowerCase())) {
			score += 1;
		}
	}

	return score;
}

function sortStoriesForSelection(
	stories: RalphPrdUserStory[],
): RalphPrdUserStory[] {
	return [...stories].sort((a, b) => {
		const pendingDelta = Number(a.passes) - Number(b.passes);
		if (pendingDelta !== 0) {
			return pendingDelta;
		}

		const priorityDelta =
			toPrioritySortValue(a.priority) - toPrioritySortValue(b.priority);
		if (priorityDelta !== 0) {
			return priorityDelta;
		}

		return a.index - b.index;
	});
}

export function selectStoryForTracking(params: {
	prdContext: RalphPrdContext;
	task: string;
	plan: string;
}): RalphPrdUserStory | undefined {
	const { prdContext, task, plan } = params;
	const pendingStories = prdContext.userStories.filter(
		(story) => !story.passes,
	);
	if (pendingStories.length === 0) {
		return undefined;
	}
	const candidateStories = pendingStories;

	const scoringTexts = [plan, task];
	let bestScore = -1;
	let bestStory: RalphPrdUserStory | undefined;
	for (const story of sortStoriesForSelection(candidateStories)) {
		const score = scoringTexts.reduce(
			(total, text) => total + scoreStoryAgainstText(story, text),
			0,
		);
		if (score > bestScore) {
			bestScore = score;
			bestStory = story;
		}
	}

	if (!bestStory) {
		return undefined;
	}

	if (bestScore <= 0) {
		return sortStoriesForSelection(candidateStories)[0];
	}
	return bestStory;
}

export async function updatePrdStoryPassStatus(params: {
	sandbox: SandboxFileInstance;
	repoTargetDir: string;
	prdContext: RalphPrdContext;
	story: RalphPrdUserStory;
	passes: boolean;
}): Promise<{ updated: boolean; reason: string }> {
	const { sandbox, repoTargetDir, prdContext, story, passes } = params;
	if (!prdContext.path.toLowerCase().endsWith("prd.json")) {
		return {
			updated: false,
			reason: "PRD pass tracking is only supported for prd.json files",
		};
	}

	const prdPath = `${repoTargetDir}/${prdContext.path}`;
	const prdReadResult = await sandbox.readFile(prdPath);
	if (!prdReadResult.success) {
		return {
			updated: false,
			reason: "Failed to read prd.json for story tracking",
		};
	}

	let parsedPrd: unknown;
	try {
		parsedPrd = JSON.parse(prdReadResult.content) as Record<string, unknown>;
	} catch {
		return {
			updated: false,
			reason: "prd.json is not valid JSON",
		};
	}

	if (!isObjectRecord(parsedPrd) || !Array.isArray(parsedPrd.userStories)) {
		return {
			updated: false,
			reason: "prd.json does not contain a valid userStories array",
		};
	}

	const rawStory = parsedPrd.userStories[story.index];
	if (!isObjectRecord(rawStory)) {
		return {
			updated: false,
			reason: "Selected story index is missing from prd.json",
		};
	}

	if (rawStory.passes === passes) {
		return {
			updated: false,
			reason: `Story already has passes=${passes}`,
		};
	}

	parsedPrd.userStories[story.index] = {
		...rawStory,
		passes,
	};

	const nextPrdContent = `${JSON.stringify(parsedPrd, null, 2)}\n`;
	const writeResult = await sandbox.writeFile(prdPath, nextPrdContent);
	if (!writeResult.success) {
		return {
			updated: false,
			reason: "Failed to write updated prd.json",
		};
	}

	return {
		updated: true,
		reason: `Updated ${formatStoryLabel(story)} to passes=${passes}`,
	};
}

export function buildStoryProgressEntry(params: {
	story: RalphPrdUserStory;
	task: string;
	qualityGatePassed: boolean;
	qualityGateSummary: string;
	now?: Date;
}): string {
	const { story, task, qualityGatePassed, qualityGateSummary, now } = params;
	const timestamp = (now ?? new Date()).toISOString();
	const status = qualityGatePassed ? "PASSED" : "FAILED";
	return `[${timestamp}] ${formatStoryLabel(story)} :: ${status} :: ${qualityGateSummary} :: Task: ${task}`;
}

export async function appendProgressEntry(params: {
	sandbox: SandboxFileInstance;
	repoTargetDir: string;
	entry: string;
	path?: string;
}): Promise<{ updated: boolean; reason: string; path: string }> {
	const { sandbox, repoTargetDir, entry } = params;
	const relativePath = params.path ?? "progress.txt";
	const progressPath = `${repoTargetDir}/${relativePath}`;
	let currentContent = "";

	const existsResult = await sandbox.exists(progressPath);
	if (existsResult.success && existsResult.exists) {
		const currentResult = await sandbox.readFile(progressPath);
		if (!currentResult.success) {
			return {
				updated: false,
				reason: "Failed to read existing progress file",
				path: relativePath,
			};
		}
		currentContent = currentResult.content;
	}

	const separator =
		currentContent.length > 0 && !currentContent.endsWith("\n") ? "\n" : "";
	const nextContent = `${currentContent}${separator}${entry}\n`;
	const writeResult = await sandbox.writeFile(progressPath, nextContent);
	if (!writeResult.success) {
		return {
			updated: false,
			reason: "Failed to update progress file",
			path: relativePath,
		};
	}

	return {
		updated: true,
		reason: "Progress log updated",
		path: relativePath,
	};
}

export async function runStoryTracker(params: {
	sandbox: SandboxFileInstance;
	repoTargetDir: string;
	prdContext?: RalphPrdContext;
	task: string;
	plan: string;
	qualityGatePassed: boolean;
	qualityGateSummary: string;
	emit: (event: {
		type: string;
		message?: string;
		storyId?: string;
		storyTitle?: string;
		path?: string;
		updated?: boolean;
	}) => Promise<void>;
}): Promise<{
	selectedStory?: RalphPrdUserStory;
	prdUpdated: boolean;
	progressUpdated: boolean;
	summary: string;
}> {
	const {
		sandbox,
		repoTargetDir,
		prdContext,
		task,
		plan,
		qualityGatePassed,
		qualityGateSummary,
		emit,
	} = params;

	if (!prdContext) {
		await emit({
			type: "story_tracker_skipped",
			message: "No structured PRD context was found for story tracking",
		});
		return {
			prdUpdated: false,
			progressUpdated: false,
			summary: "Story tracker skipped: no structured PRD context found.",
		};
	}

	const selectedStory = selectStoryForTracking({
		prdContext,
		task,
		plan,
	});
	if (!selectedStory) {
		await emit({
			type: "story_tracker_skipped",
			message: "No user story was available for tracking",
		});
		return {
			prdUpdated: false,
			progressUpdated: false,
			summary: "Story tracker skipped: no user stories were found.",
		};
	}

	await emit({
		type: "story_tracker_selected",
		storyId: selectedStory.id,
		storyTitle: selectedStory.title,
		message: `Tracking ${formatStoryLabel(selectedStory)}`,
	});

	const prdUpdateResult = await updatePrdStoryPassStatus({
		sandbox,
		repoTargetDir,
		prdContext,
		story: selectedStory,
		passes: qualityGatePassed,
	});

	await emit({
		type: "story_tracker_prd_updated",
		storyId: selectedStory.id,
		storyTitle: selectedStory.title,
		updated: prdUpdateResult.updated,
		message: prdUpdateResult.reason,
		path: prdContext.path,
	});

	const progressEntry = buildStoryProgressEntry({
		story: selectedStory,
		task,
		qualityGatePassed,
		qualityGateSummary,
	});
	const progressResult = await appendProgressEntry({
		sandbox,
		repoTargetDir,
		entry: progressEntry,
	});

	await emit({
		type: "story_tracker_progress_updated",
		storyId: selectedStory.id,
		storyTitle: selectedStory.title,
		updated: progressResult.updated,
		message: progressResult.reason,
		path: progressResult.path,
	});

	return {
		selectedStory,
		prdUpdated: prdUpdateResult.updated,
		progressUpdated: progressResult.updated,
		summary: `Story tracker finished for ${formatStoryLabel(selectedStory)}.`,
	};
}
