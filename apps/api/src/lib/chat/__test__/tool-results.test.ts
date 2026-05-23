import { describe, expect, it } from "vitest";

import type { Message, ToolCall } from "~/types";
import { ToolCallType } from "~/types";
import {
	getFinalToolResultsForCalls,
	isSuccessfulToolStatus,
	shouldContinueAfterToolResults,
} from "../tool-results";

describe("tool result continuation", () => {
	const toolCall: ToolCall = {
		id: "call-1",
		type: ToolCallType.FUNCTION,
		function: {
			name: "run_feature_implementation",
			arguments: "{}",
		},
	};

	it("continues after successful final tool results", () => {
		const toolResults = [
			{
				role: "tool",
				name: "run_feature_implementation",
				tool_call_id: "call-1",
				status: "completed",
				content: "done",
			},
		] as Message[];

		expect(shouldContinueAfterToolResults([toolCall], toolResults)).toBe(true);
	});

	it("stops after failed final tool results", () => {
		const toolResults = [
			{
				role: "tool",
				name: "sandbox_event",
				tool_call_id: "call-1",
				status: "run_failed",
				content: "Run failed",
			},
			{
				role: "tool",
				name: "run_feature_implementation",
				tool_call_id: "call-1",
				status: "failed",
				content: "Worker not found",
			},
		] as Message[];

		expect(shouldContinueAfterToolResults([toolCall], toolResults)).toBe(false);
	});

	it("uses the final result for each requested tool call", () => {
		const toolResults = [
			{
				role: "tool",
				name: "sandbox_event",
				tool_call_id: "call-1",
				status: "run_failed",
				content: "Run failed",
			},
			{
				role: "tool",
				name: "run_feature_implementation",
				tool_call_id: "call-1",
				status: "failed",
				content: "Worker not found",
			},
		] as Message[];

		expect(getFinalToolResultsForCalls([toolCall], toolResults)).toEqual([
			expect.objectContaining({
				name: "run_feature_implementation",
				status: "failed",
			}),
		]);
	});

	it("only treats success and completed statuses as successful", () => {
		expect(isSuccessfulToolStatus("success")).toBe(true);
		expect(isSuccessfulToolStatus("completed")).toBe(true);
		expect(isSuccessfulToolStatus("failed")).toBe(false);
		expect(isSuccessfulToolStatus("run_failed")).toBe(false);
		expect(isSuccessfulToolStatus("error")).toBe(false);
	});
});
