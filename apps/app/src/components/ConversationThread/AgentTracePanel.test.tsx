import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgentTraceButton } from "./AgentTracePanel";

describe("AgentTraceButton", () => {
	it("opens trace details from a header-sized button", () => {
		render(
			<AgentTraceButton
				entries={[
					{
						id: "user:user-1",
						type: "user_turn",
						label: "hi",
					},
					{
						id: "model:user-1:assistant-1",
						type: "model_call",
						label: "gpt-5.4-mini",
						latencyMs: 2900,
						usage: {
							totalTokens: 2135,
						},
					},
				]}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "View conversation trace" }));

		expect(screen.getByRole("dialog", { name: "Conversation trace" })).toBeInTheDocument();
		expect(screen.getByText("hi")).toBeInTheDocument();
		expect(screen.getByText("gpt-5.4-mini")).toBeInTheDocument();
	});
});
