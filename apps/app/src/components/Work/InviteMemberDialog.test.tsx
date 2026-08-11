import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InviteMemberDialog } from "./InviteMemberDialog";

const reset = vi.fn();

vi.mock("~/hooks/useWorkspaces", () => ({
	useInviteWorkspaceMember: () => ({
		data: { inviteUrl: "https://polychat.test/work/invitations?token=secret" },
		error: null,
		isPending: false,
		mutateAsync: vi.fn(),
		reset,
	}),
}));

describe("InviteMemberDialog", () => {
	it("clears a completed invitation before the dialog is opened again", () => {
		const onOpenChange = vi.fn();
		render(
			<InviteMemberDialog
				workspaceId="workspace-1"
				canInviteAdmin
				open
				onOpenChange={onOpenChange}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Done" }));

		expect(reset).toHaveBeenCalledOnce();
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});
