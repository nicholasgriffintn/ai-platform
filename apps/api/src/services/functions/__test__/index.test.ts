import { describe, expect, it, vi } from "vitest";
import type { IRequest } from "~/types";
import { ErrorType } from "~/utils/errors";

const mockHandleMCPTool = vi.fn();

vi.mock("../mcp", () => ({
	handleMCPTool: (...args: unknown[]) => mockHandleMCPTool(...args),
}));

import { handleFunctions } from "../index";

function buildRequest(overrides?: Partial<IRequest>): IRequest {
	return {
		env: { AI: {} } as any,
		mode: "build",
		user: { id: 1, plan_id: "pro" } as any,
		request: {
			completion_id: "completion-123",
			input: "test",
			date: "2026-03-15",
			mode: "build",
		},
		...overrides,
	};
}

describe("handleFunctions approval gating", () => {
	it("returns approval-required error for MCP tools in build mode", async () => {
		await expect(
			handleFunctions({
				completion_id: "completion-123",
				app_url: undefined,
				functionName: "mcp_test",
				args: {},
				request: buildRequest(),
			}),
		).rejects.toMatchObject({
			type: ErrorType.AUTHORISATION_ERROR,
			statusCode: 403,
			context: expect.objectContaining({
				toolName: "mcp_test",
				requiresApproval: true,
			}),
		});

		expect(mockHandleMCPTool).not.toHaveBeenCalled();
	});

	it("executes MCP tool when pre-approved via approved_tools", async () => {
		mockHandleMCPTool.mockResolvedValueOnce({
			name: "mcp_test",
			status: "success",
			content: "ok",
		});

		const request = buildRequest({
			request: {
				completion_id: "completion-123",
				input: "test",
				date: "2026-03-15",
				mode: "build",
				approved_tools: ["mcp_test"],
			},
		});

		const result = await handleFunctions({
			completion_id: "completion-123",
			app_url: undefined,
			functionName: "mcp_test",
			args: { any: "value" },
			request,
		});

		expect(result).toMatchObject({
			name: "mcp_test",
			status: "success",
			content: "ok",
		});
		expect(mockHandleMCPTool).toHaveBeenCalledWith(
			"completion-123",
			{ any: "value" },
			expect.objectContaining({
				request: expect.objectContaining({
					functionName: "mcp_test",
				}),
			}),
			undefined,
			undefined,
		);
	});
});
