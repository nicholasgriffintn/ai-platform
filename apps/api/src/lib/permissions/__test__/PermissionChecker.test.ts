import { describe, expect, it } from "vitest";
import type { IUser } from "~/types";
import {
	PermissionChecker,
	resolveModeMaxSteps,
	resolveToolPermissions,
} from "../PermissionChecker";

const proUser: IUser = {
	id: 1,
	name: "Pro User",
	avatar_url: null,
	email: "pro@example.com",
	github_username: null,
	company: null,
	site: null,
	location: null,
	bio: null,
	twitter_username: null,
	created_at: "2026-01-01T00:00:00.000Z",
	updated_at: "2026-01-01T00:00:00.000Z",
	setup_at: null,
	terms_accepted_at: null,
	plan_id: "pro",
};

const freeUser: IUser = {
	...proUser,
	id: 2,
	email: "free@example.com",
	plan_id: "free",
};

describe("PermissionChecker", () => {
	it("allows unrestricted access in chat mode", () => {
		const checker = new PermissionChecker();
		const result = checker.checkToolAccess({
			toolName: "run_refactoring",
			mode: "normal",
			user: proUser,
			toolType: "premium",
			toolPermissions: ["sandbox", "write"],
		});

		expect(result.allowed).toBe(true);
		expect(result.requiresApproval).toBe(false);
	});

	it("allows read-only tools in plan mode", () => {
		const checker = new PermissionChecker();
		const result = checker.checkToolAccess({
			toolName: "web_search",
			mode: "plan",
			user: proUser,
			toolType: "normal",
			toolPermissions: ["read"],
		});

		expect(result.allowed).toBe(true);
		expect(result.requiresApproval).toBe(false);
	});

	it("blocks network tools in plan mode", () => {
		const checker = new PermissionChecker();
		const result = checker.checkToolAccess({
			toolName: "call_api",
			mode: "plan",
			user: proUser,
			toolType: "normal",
			toolPermissions: ["network"],
		});

		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("plan");
	});

	it("blocks write tools in explore mode", () => {
		const checker = new PermissionChecker();
		const result = checker.checkToolAccess({
			toolName: "create_note",
			mode: "explore",
			user: proUser,
			toolType: "normal",
			toolPermissions: ["write"],
		});

		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("explore");
	});

	it("flags risky tools as approval-required in build mode", () => {
		const checker = new PermissionChecker();
		const result = checker.checkToolAccess({
			toolName: "run_refactoring",
			mode: "build",
			user: proUser,
			toolType: "premium",
			toolPermissions: ["sandbox", "write"],
		});

		expect(result.allowed).toBe(true);
		expect(result.requiresApproval).toBe(true);
	});

	it("blocks premium tools for non-pro users", () => {
		const checker = new PermissionChecker();
		const result = checker.checkToolAccess({
			toolName: "create_image",
			mode: "chat",
			user: freeUser,
			toolType: "premium",
			toolPermissions: ["network"],
		});

		expect(result.allowed).toBe(false);
		expect(result.reason).toBe("This tool requires a premium subscription");
	});
});

describe("permission helpers", () => {
	it("normalises explicit permissions and drops invalid values", () => {
		expect(
			resolveToolPermissions("any_tool", [
				"READ",
				"read",
				"invalid",
				"reasoning",
			]),
		).toEqual(["read", "reasoning"]);
	});

	it("returns empty permissions when no explicit permissions exist", () => {
		expect(resolveToolPermissions("any_tool")).toEqual([]);
	});

	it("resolves max steps by mode", () => {
		expect(resolveModeMaxSteps("plan", 30)).toBe(24);
		expect(resolveModeMaxSteps("build", 10)).toBe(10);
		expect(resolveModeMaxSteps("normal")).toBe(1);
	});
});
