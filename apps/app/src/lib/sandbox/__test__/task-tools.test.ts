import { describe, expect, it } from "vitest";

import { SANDBOX_TASK_TOOL_NAMES, getSandboxTaskToolNames } from "../task-tools";

describe("sandbox task tools", () => {
	it("returns all coding task tools when no task is selected", () => {
		expect(getSandboxTaskToolNames()).toEqual([...SANDBOX_TASK_TOOL_NAMES]);
	});

	it("limits tool exposure to the selected coding task", () => {
		expect(getSandboxTaskToolNames("bug-fix")).toEqual(["run_bug_fix"]);
		expect(getSandboxTaskToolNames("code-review")).toEqual(["run_code_review"]);
	});
});
