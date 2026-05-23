import { describe, expect, it } from "vitest";

import { SANDBOX_MODE_TOOL_NAMES, getSandboxModeToolNames } from "../chat-mode";

describe("sandbox chat mode tools", () => {
	it("enables all sandbox tools when no task type is selected", () => {
		expect(getSandboxModeToolNames()).toEqual([...SANDBOX_MODE_TOOL_NAMES]);
	});

	it("narrows tools to the selected sandbox task type", () => {
		expect(getSandboxModeToolNames("bug-fix")).toEqual(["run_bug_fix"]);
		expect(getSandboxModeToolNames("code-review")).toEqual(["run_code_review"]);
	});
});
