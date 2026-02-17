import { describe, expect, it } from "vitest";

import {
	appendProgressEntry,
	runStoryTracker,
	selectStoryForTracking,
	updatePrdStoryPassStatus,
} from "../feature-implementation/story-tracker";
import type {
	RalphPrdContext,
	SandboxFileInstance,
} from "../feature-implementation/types";

function createFileSandbox(initialFiles: Record<string, string>): {
	sandbox: SandboxFileInstance;
	files: Map<string, string>;
} {
	const files = new Map(Object.entries(initialFiles));
	const sandbox: SandboxFileInstance = {
		readFile: async (path) => {
			if (!files.has(path)) {
				return {
					success: false,
					path,
					content: "",
					timestamp: new Date().toISOString(),
				};
			}
			return {
				success: true,
				path,
				content: files.get(path) ?? "",
				timestamp: new Date().toISOString(),
			};
		},
		writeFile: async (path, content) => {
			files.set(path, content);
			return {
				success: true,
				path,
				timestamp: new Date().toISOString(),
			};
		},
		exists: async (path) => {
			return {
				success: true,
				path,
				exists: files.has(path),
				timestamp: new Date().toISOString(),
			};
		},
	};

	return {
		sandbox,
		files,
	};
}

describe("story tracker helpers", () => {
	const prdContext: RalphPrdContext = {
		path: "prd.json",
		project: "Demo",
		description: "Demo stories",
		userStories: [
			{
				index: 0,
				id: "US-001",
				title: "Add logout button",
				description: "Add logout control in navbar",
				passes: false,
				priority: 2,
				acceptanceCriteria: ["Button appears", "Logout works"],
			},
			{
				index: 1,
				id: "US-002",
				title: "Refine spacing",
				description: "Polish spacing",
				passes: false,
				priority: 1,
				acceptanceCriteria: ["Spacing consistent"],
			},
		],
	};

	it("selects a matching story based on plan/task text", () => {
		const story = selectStoryForTracking({
			prdContext,
			task: "Implement US-001 in the app shell",
			plan: "First complete story US-001 Add logout button",
		});

		expect(story?.id).toBe("US-001");
	});

	it("skips selection when all stories already pass", () => {
		const story = selectStoryForTracking({
			prdContext: {
				...prdContext,
				userStories: prdContext.userStories.map((entry) => ({
					...entry,
					passes: true,
				})),
			},
			task: "Any task",
			plan: "Any plan",
		});

		expect(story).toBeUndefined();
	});

	it("updates passes flag for selected story in prd.json", async () => {
		const { sandbox, files } = createFileSandbox({
			"repo/prd.json": JSON.stringify(
				{
					project: "Demo",
					userStories: [
						{
							id: "US-001",
							title: "Add logout button",
							description: "Add logout control in navbar",
							passes: false,
						},
					],
				},
				null,
				2,
			),
		});

		const update = await updatePrdStoryPassStatus({
			sandbox,
			repoTargetDir: "repo",
			prdContext: {
				...prdContext,
				userStories: [prdContext.userStories[0]],
			},
			story: prdContext.userStories[0],
			passes: true,
		});

		expect(update.updated).toBe(true);
		const nextPrd = files.get("repo/prd.json");
		expect(nextPrd).toBeTruthy();
		expect(nextPrd).toContain('"passes": true');
	});

	it("runs full tracker and appends progress entry", async () => {
		const { sandbox, files } = createFileSandbox({
			"repo/prd.json": JSON.stringify(
				{
					project: "Demo",
					userStories: [
						{
							id: "US-001",
							title: "Add logout button",
							description: "Add logout control in navbar",
							passes: false,
						},
					],
				},
				null,
				2,
			),
		});

		const result = await runStoryTracker({
			sandbox,
			repoTargetDir: "repo",
			prdContext: {
				...prdContext,
				userStories: [prdContext.userStories[0]],
			},
			task: "Implement US-001 logout flow",
			plan: "Implement US-001 Add logout button first",
			qualityGatePassed: true,
			qualityGateSummary: "Quality gate passed (2/2 checks passed).",
			emit: async () => undefined,
		});

		expect(result.prdUpdated).toBe(true);
		expect(result.progressUpdated).toBe(true);
		expect(files.get("repo/progress.txt")).toContain(
			"US-001 Add logout button",
		);
	});

	it("appends progress entries to an existing file", async () => {
		const { sandbox, files } = createFileSandbox({
			"repo/progress.txt": "existing\n",
		});

		await appendProgressEntry({
			sandbox,
			repoTargetDir: "repo",
			entry: "new entry",
		});

		expect(files.get("repo/progress.txt")).toBe("existing\nnew entry\n");
	});
});
