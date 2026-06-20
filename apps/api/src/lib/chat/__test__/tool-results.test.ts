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

	it("continues after recoverable recipe setup correction results", () => {
		const configureRecipeCall: ToolCall = {
			id: "call-2",
			type: ToolCallType.FUNCTION,
			function: {
				name: "configure_recipe",
				arguments: "{}",
			},
		};
		const toolResults = [
			{
				role: "tool",
				name: "configure_recipe",
				tool_call_id: "call-2",
				status: "needs_correction",
				content: "Retry with the exact recipe field keys.",
				data: { recoverable: true },
			},
		] as Message[];

		expect(shouldContinueAfterToolResults([configureRecipeCall], toolResults)).toBe(true);
	});

	it("does not continue after non-recipe correction statuses", () => {
		const toolResults = [
			{
				role: "tool",
				name: "run_feature_implementation",
				tool_call_id: "call-1",
				status: "needs_correction",
				content: "Retry with different arguments.",
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
		expect(isSuccessfulToolStatus("needs_correction")).toBe(false);
		expect(isSuccessfulToolStatus("failed")).toBe(false);
		expect(isSuccessfulToolStatus("run_failed")).toBe(false);
		expect(isSuccessfulToolStatus("error")).toBe(false);
	});
});
