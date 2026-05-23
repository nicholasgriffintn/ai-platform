import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultCouncilMemberIds } from "@assistant/schemas";

import { CouncilChatControls } from "./CouncilChatControls";

describe("CouncilChatControls", () => {
	it("collapses expanded member controls when conversation messages exist", () => {
		const props = {
			selectedMemberIds: [...defaultCouncilMemberIds],
			onSelectedMemberIdsChange: vi.fn(),
			responseMode: "debate" as const,
			onResponseModeChange: vi.fn(),
		};

		const { rerender } = render(<CouncilChatControls {...props} />);

		fireEvent.click(screen.getByRole("button", { name: /Council/i }));
		expect(screen.getByRole("button", { name: "Chamber" })).toBeInTheDocument();

		rerender(<CouncilChatControls {...props} hasConversationMessages={true} />);

		expect(screen.queryByRole("button", { name: "Chamber" })).not.toBeInTheDocument();
	});
});
