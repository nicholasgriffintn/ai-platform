import { describe, expect, it } from "vitest";

import { resolveSandboxTaskProfile } from "../task-profile";

describe("resolveSandboxTaskProfile", () => {
	it("keeps implementation tasks writable and commit-aware", () => {
		const profile = resolveSandboxTaskProfile({
			userId: 1,
			repo: "owner/repo",
			task: "Add a logout button",
			taskType: "feature-implementation",
			shouldCommit: true,
			polychatApiUrl: "https://api.polychat.app",
		});

		expect(profile).toMatchObject({
			taskType: "feature-implementation",
			task: "Add a logout button",
			shouldCommit: true,
			readOnlyCommands: false,
		});
	});

	it("forces code review tasks to read-only mode", () => {
		const profile = resolveSandboxTaskProfile({
			userId: 1,
			repo: "owner/repo",
			task: "Review the auth middleware changes",
			taskType: "code-review",
			shouldCommit: true,
			polychatApiUrl: "https://api.polychat.app",
		});

		expect(profile.taskType).toBe("code-review");
		expect(profile.shouldCommit).toBe(false);
		expect(profile.readOnlyCommands).toBe(true);
		expect(profile.task).toContain("Do not modify files");
	});

	it("forces test suite tasks to read-only mode", () => {
		const profile = resolveSandboxTaskProfile({
			userId: 1,
			repo: "owner/repo",
			task: "Run the API integration tests",
			taskType: "test-suite",
			shouldCommit: true,
			polychatApiUrl: "https://api.polychat.app",
		});

		expect(profile.taskType).toBe("test-suite");
		expect(profile.shouldCommit).toBe(false);
		expect(profile.readOnlyCommands).toBe(true);
		expect(profile.task).toContain("Run and analyse the relevant test suites");
	});

	it("keeps bug-fix tasks writable", () => {
		const profile = resolveSandboxTaskProfile({
			userId: 1,
			repo: "owner/repo",
			task: "Fix race condition in webhook dedupe",
			taskType: "bug-fix",
			shouldCommit: true,
			polychatApiUrl: "https://api.polychat.app",
		});

		expect(profile.taskType).toBe("bug-fix");
		expect(profile.shouldCommit).toBe(true);
		expect(profile.readOnlyCommands).toBe(false);
		expect(profile.task).toContain("Bug report:");
	});
});
