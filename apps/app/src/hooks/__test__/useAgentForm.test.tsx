import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useAgentForm } from "../useAgentForm";

describe("useAgentForm", () => {
	it("loads enabled_tools from agent data", () => {
		const { result } = renderHook(() => useAgentForm());
		const agent = {
			id: "agent-1",
			name: "Agent",
			enabled_tools: '["web_search","bad tool","get_weather","web_search"]',
		};

		act(() => {
			result.current.loadAgentData(agent, {
				"gpt-4": { supportsToolCalls: true },
			});
		});

		expect(result.current.enabledTools).toEqual(["web_search", "get_weather"]);
	});

	it("includes enabled_tools in form payload when set", () => {
		const { result } = renderHook(() => useAgentForm());

		act(() => {
			result.current.setName("Agent");
			result.current.setEnabledTools(["web_search", "bad tool", "web_search"]);
		});

		expect(result.current.getFormData()).toEqual(
			expect.objectContaining({
				name: "Agent",
				enabled_tools: ["web_search"],
			}),
		);
	});

	it("omits enabled_tools when selected values are invalid", () => {
		const { result } = renderHook(() => useAgentForm());

		act(() => {
			result.current.setName("Agent");
			result.current.setEnabledTools(["bad tool"]);
		});

		expect(result.current.getFormData()).not.toHaveProperty("enabled_tools");
	});
});
