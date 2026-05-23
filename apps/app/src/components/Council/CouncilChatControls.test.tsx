import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultCouncilMemberIds } from "@assistant/schemas";

import { CouncilChatControls } from "./CouncilChatControls";

describe("CouncilChatControls", () => {
	it("shows member controls without a secondary collapse step", () => {
		const props = {
			selectedMemberIds: [defaultCouncilMemberIds[0]],
			onSelectedMemberIdsChange: vi.fn(),
			responseMode: "debate" as const,
			onResponseModeChange: vi.fn(),
		};

		render(<CouncilChatControls {...props} />);

		expect(screen.getByRole("button", { name: "Chamber" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Single" })).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "All" }));

		expect(props.onSelectedMemberIdsChange).toHaveBeenCalledWith([...defaultCouncilMemberIds]);
	});
});
