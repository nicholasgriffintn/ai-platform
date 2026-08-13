import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConnectorApprovalCard } from "./ConnectorApprovalCard";

describe("ConnectorApprovalCard", () => {
	it.each([
		["approved", "Action approved."],
		["rejected", "Action rejected."],
		["consumed", "Action completed."],
		["expired", "This approval has expired."],
	] as const)("restores the %s state without action buttons", (status, expectedText) => {
		render(
			<ConnectorApprovalCard
				data={{
					approvalRequired: true,
					approvalId: "coa_action",
					provider: "googleslides",
					operation: "GOOGLESLIDES_CREATE_SLIDES_MARKDOWN",
					humanInTheLoop: {
						type: "approval",
						status,
						requires_user_action: false,
					},
				}}
				onResolve={vi.fn()}
			/>,
		);

		expect(screen.getByText(expectedText)).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Approve and continue" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
	});

	it("shows the exact provider operation and resumes an approved action", async () => {
		const onResolve = vi.fn().mockResolvedValue(undefined);
		render(
			<ConnectorApprovalCard
				data={{
					approvalRequired: true,
					approvalId: "coa_action",
					provider: "google-drive",
					operation: "GOOGLE_DRIVE_DELETE_FILE",
					argumentSummary: { fileId: "file_123", accessToken: "[redacted]" },
					expiresAt: "2099-08-13T10:00:00.000Z",
				}}
				onResolve={onResolve}
			/>,
		);

		expect(screen.getByText("GOOGLE_DRIVE_DELETE_FILE")).toBeInTheDocument();
		expect(screen.getByText("Google Drive")).toBeInTheDocument();
		expect(screen.getByText("Action details")).toBeInTheDocument();
		expect(screen.getByText(/file_123/)).toBeInTheDocument();
		expect(screen.getByText(/\[redacted\]/)).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Approve and continue" }));

		await waitFor(() => expect(onResolve).toHaveBeenCalledWith("coa_action", "approved"));
		expect(screen.getByText("Action approved.")).toBeInTheDocument();
	});

	it("does not offer controls for an expired approval", () => {
		render(
			<ConnectorApprovalCard
				data={{
					approvalRequired: true,
					approvalId: "coa_expired",
					provider: "airtable",
					operation: "AIRTABLE_DELETE_RECORD",
					expiresAt: "2020-01-01T00:00:00.000Z",
				}}
				onResolve={vi.fn()}
			/>,
		);

		expect(screen.getByText("This approval has expired.")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Approve and continue" })).toBeNull();
	});

	it("submits only once when approval is activated repeatedly before rendering updates", async () => {
		let finishResolution: (() => void) | undefined;
		const onResolve = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					finishResolution = resolve;
				}),
		);
		render(
			<ConnectorApprovalCard
				data={{
					approvalRequired: true,
					approvalId: "coa_action",
					provider: "gmail",
					operation: "GMAIL_CREATE_DRAFT",
					expiresAt: "2099-08-13T10:00:00.000Z",
				}}
				onResolve={onResolve}
			/>,
		);

		const approve = screen.getByRole("button", { name: "Approve and continue" });
		fireEvent.click(approve);
		fireEvent.click(approve);

		expect(onResolve).toHaveBeenCalledOnce();
		finishResolution?.();
		await waitFor(() => expect(screen.getByText("Action approved.")).toBeInTheDocument());
	});

	it("prefers refreshed server state and does not carry local state to another approval", async () => {
		const onResolve = vi.fn().mockResolvedValue(undefined);
		const { rerender } = render(
			<ConnectorApprovalCard
				data={{
					approvalRequired: true,
					approvalId: "coa_first",
					provider: "gmail",
					operation: "GMAIL_CREATE_DRAFT",
				}}
				onResolve={onResolve}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Approve and continue" }));
		await waitFor(() => expect(screen.getByText("Action approved.")).toBeInTheDocument());

		rerender(
			<ConnectorApprovalCard
				data={{
					approvalRequired: true,
					approvalId: "coa_first",
					provider: "gmail",
					operation: "GMAIL_CREATE_DRAFT",
					humanInTheLoop: {
						type: "approval",
						status: "consumed",
						requires_user_action: false,
					},
				}}
				onResolve={onResolve}
			/>,
		);
		expect(screen.getByText("Action completed.")).toBeInTheDocument();

		rerender(
			<ConnectorApprovalCard
				data={{
					approvalRequired: true,
					approvalId: "coa_second",
					provider: "gmail",
					operation: "GMAIL_SEND_EMAIL",
				}}
				onResolve={onResolve}
			/>,
		);
		expect(screen.getByRole("button", { name: "Approve and continue" })).toBeInTheDocument();
	});
});
