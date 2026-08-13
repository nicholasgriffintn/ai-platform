import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	create: vi.fn(),
	claimForExecution: vi.fn(),
	markCleanupPending: vi.fn(),
	deleteRecord: vi.fn(),
	createComposioToolSession: vi.fn(),
	searchComposioSessionTools: vi.fn(),
	deleteComposioToolSession: vi.fn(),
	executeComposioSessionTool: vi.fn(),
	listComposioConnectedAccounts: vi.fn(),
	createActivity: vi.fn(),
	getSelectedRecipeConnectorAccountId: vi.fn(),
	assertComposioFileBridgeAvailable: vi.fn(),
	createComposioMountFileClient: vi.fn(() => ({ name: "mount-client" })),
	resolveComposioFileReferences: vi.fn(),
	importComposioOperationFileResults: vi.fn(),
}));

vi.mock("../accounts", () => ({
	getSelectedRecipeConnectorAccountId: mocks.getSelectedRecipeConnectorAccountId,
}));

vi.mock("~/lib/providers/capabilities/connectors/composio/client", () => ({
	createComposioToolSession: mocks.createComposioToolSession,
	searchComposioSessionTools: mocks.searchComposioSessionTools,
	deleteComposioToolSession: mocks.deleteComposioToolSession,
	executeComposioSessionTool: mocks.executeComposioSessionTool,
	listComposioConnectedAccounts: mocks.listComposioConnectedAccounts,
}));

vi.mock("../composio-files", () => ({
	assertComposioFileBridgeAvailable: mocks.assertComposioFileBridgeAvailable,
	createComposioMountFileClient: mocks.createComposioMountFileClient,
	resolveComposioFileReferences: mocks.resolveComposioFileReferences,
	importComposioOperationFileResults: mocks.importComposioOperationFileResults,
}));

import { getConnectorProviderConfig } from "~/lib/providers/capabilities/connectors";
import {
	closeComposioConnectorRun,
	discoverComposioRunTools,
	executeComposioRunTool,
} from "../composio-run";

const account = {
	id: "ca_gmail",
	userId: "polychat:test:user:42",
	toolkitSlug: "gmail",
	authConfigId: "ac_uRCWNPtnTpEw",
	status: "ACTIVE",
	createdAt: "2026-08-12T10:00:00.000Z",
	updatedAt: "2026-08-12T11:00:00.000Z",
	isDisabled: false,
};

const session = {
	id: "ccs_opaque",
	remoteSessionId: "trs_remote",
	kind: "tool" as const,
	userId: 42,
	provider: "gmail",
	toolkitSlug: "gmail",
	authConfigId: "ac_uRCWNPtnTpEw",
	connectedAccountId: "ca_gmail",
	allowedOperationIds: ["GMAIL_FETCH_EMAILS"],
	runId: "connector_run_1",
	completionId: "completion-1",
	recipeId: "gmail-recipe",
	installationId: null,
	state: "active" as const,
	createdAt: "2026-08-13T00:00:00.000Z",
	expiresAt: "2026-08-13T00:30:00.000Z",
	claimedAt: null,
	cleanupAttempts: 0,
	cleanupAfter: null,
};

const testEnv = {};

function context() {
	return {
		env: testEnv,
		connectorRunId: "connector_run_1",
		requestCache: new Map(),
		repositories: {
			composioConnectorSessions: {
				create: mocks.create,
				claimForExecution: mocks.claimForExecution,
				markCleanupPending: mocks.markCleanupPending,
				delete: mocks.deleteRecord,
			},
			activities: { createActivity: mocks.createActivity },
		},
	} as never;
}

describe("Composio connector run lifecycle", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.create.mockResolvedValue(session);
		mocks.claimForExecution.mockResolvedValue({ ...session, state: "claimed" });
		mocks.createComposioToolSession.mockResolvedValue("trs_remote");
		mocks.searchComposioSessionTools.mockResolvedValue({
			sessionId: "trs_remote",
			tools: [{ slug: "GMAIL_FETCH_EMAILS" }],
		});
		mocks.deleteComposioToolSession.mockResolvedValue(undefined);
		mocks.listComposioConnectedAccounts.mockResolvedValue([account]);
		mocks.executeComposioSessionTool.mockResolvedValue({
			data: { messages: [] },
			logId: "log_1",
		});
		mocks.createActivity.mockResolvedValue({});
		mocks.getSelectedRecipeConnectorAccountId.mockResolvedValue(undefined);
		mocks.resolveComposioFileReferences.mockImplementation(({ value }) => Promise.resolve(value));
		mocks.importComposioOperationFileResults.mockImplementation(({ value }) =>
			Promise.resolve(value),
		);
	});

	it("imports explicit Composio mount outputs before returning model-visible data", async () => {
		const runContext = context();
		const provider = getConnectorProviderConfig("gmail")!;
		mocks.executeComposioSessionTool.mockResolvedValueOnce({
			data: { file: { mount_relative_path: "report.pdf" } },
			logId: "log_file",
		});
		mocks.importComposioOperationFileResults.mockResolvedValueOnce({
			file: { $assistantOutput: { id: "output_1", filename: "report.pdf" } },
		});

		await expect(
			executeComposioRunTool({
				context: runContext,
				userId: 42,
				provider,
				operationId: "GMAIL_FETCH_EMAILS",
				arguments: {},
				sessionId: "ccs_opaque",
				scope: { completionId: "completion-1" },
			}),
		).resolves.toMatchObject({
			data: { file: { $assistantOutput: { id: "output_1" } } },
		});
		expect(mocks.importComposioOperationFileResults).toHaveBeenCalledWith(
			expect.objectContaining({ sessionId: "trs_remote", userId: 42 }),
		);
	});

	it("stages file references against the claimed remote session before execution", async () => {
		const runContext = context();
		const provider = getConnectorProviderConfig("gmail")!;
		mocks.resolveComposioFileReferences.mockResolvedValueOnce({ attachment: "/mnt/files/a.pdf" });

		await executeComposioRunTool({
			context: runContext,
			userId: 42,
			provider,
			operationId: "GMAIL_FETCH_EMAILS",
			arguments: { attachment: { $assistantFile: { kind: "source", id: "src_1" } } },
			sessionId: "ccs_opaque",
			scope: { completionId: "completion-1" },
		});

		expect(mocks.resolveComposioFileReferences).toHaveBeenCalledWith(
			expect.objectContaining({ sessionId: "trs_remote", userId: 42 }),
		);
		expect(mocks.executeComposioSessionTool).toHaveBeenCalledWith(
			expect.objectContaining({ arguments: { attachment: "/mnt/files/a.pdf" } }),
		);
	});

	it("returns an opaque lease and compensates when discovery cannot be persisted", async () => {
		const runContext = context();
		const provider = getConnectorProviderConfig("gmail")!;
		await expect(
			discoverComposioRunTools({
				context: runContext,
				userId: 42,
				provider,
				connectedAccount: account,
				allowedOperationIds: ["GMAIL_FETCH_EMAILS"],
				useCase: "Find invoices",
				scope: { completionId: "completion-1", recipeId: "gmail-recipe" },
			}),
		).resolves.toMatchObject({ sessionId: "ccs_opaque" });

		mocks.create.mockRejectedValueOnce(new Error("database unavailable"));
		await expect(
			discoverComposioRunTools({
				context: runContext,
				userId: 42,
				provider,
				connectedAccount: account,
				allowedOperationIds: ["GMAIL_FETCH_EMAILS"],
				useCase: "Find invoices",
				scope: { completionId: "completion-1", recipeId: "gmail-recipe" },
			}),
		).rejects.toThrow("database unavailable");
		expect(mocks.deleteComposioToolSession).toHaveBeenCalledWith({
			env: testEnv,
			sessionId: "trs_remote",
		});
	});

	it("claims an operation-bound lease and keeps the remote session until run completion", async () => {
		const runContext = context();
		const provider = getConnectorProviderConfig("gmail")!;
		await expect(
			executeComposioRunTool({
				context: runContext,
				userId: 42,
				provider,
				operationId: "GMAIL_FETCH_EMAILS",
				arguments: { query: "invoice" },
				sessionId: "ccs_opaque",
				scope: { completionId: "completion-1", recipeId: "gmail-recipe" },
			}),
		).resolves.toMatchObject({ data: { messages: [] }, logId: "log_1" });
		expect(mocks.executeComposioSessionTool).toHaveBeenCalledWith(
			expect.objectContaining({
				sessionId: "trs_remote",
				authConfigId: "ac_uRCWNPtnTpEw",
				connectedAccountId: "ca_gmail",
			}),
		);
		expect(mocks.deleteComposioToolSession).not.toHaveBeenCalled();
		expect(mocks.createActivity).toHaveBeenCalledWith(
			expect.objectContaining({
				capabilityId: "connector:gmail",
				groupId: "connector_run_1",
				kind: "connector_operation",
				status: "succeeded",
				data: expect.objectContaining({
					sessionHandle: "ccs_opaque",
					selectedAccountId: "ca_gmail",
				}),
			}),
		);

		await closeComposioConnectorRun(runContext);
		expect(mocks.deleteComposioToolSession).toHaveBeenCalledWith({
			env: testEnv,
			sessionId: "trs_remote",
		});
		expect(mocks.deleteRecord).toHaveBeenCalledWith("ccs_opaque");
	});

	it("records failures without storing arguments and ignores telemetry persistence failure", async () => {
		const runContext = context();
		const provider = getConnectorProviderConfig("gmail")!;
		mocks.executeComposioSessionTool.mockRejectedValueOnce(new Error("provider failed"));
		mocks.createActivity.mockRejectedValueOnce(new Error("analytics unavailable"));

		await expect(
			executeComposioRunTool({
				context: runContext,
				userId: 42,
				provider,
				operationId: "GMAIL_FETCH_EMAILS",
				arguments: { secret: "must-not-persist" },
				sessionId: "ccs_opaque",
				scope: { completionId: "completion-1", recipeId: "gmail-recipe" },
			}),
		).rejects.toThrow("provider failed");
		const activityInput = mocks.createActivity.mock.calls[0]?.[0];
		expect(activityInput).toMatchObject({ status: "failed" });
		expect(JSON.stringify(activityInput)).not.toContain("must-not-persist");
		expect(JSON.stringify(activityInput)).not.toContain("trs_remote");
	});

	it("leaves a durable cleanup retry when remote deletion fails", async () => {
		const runContext = context();
		const provider = getConnectorProviderConfig("gmail")!;
		await executeComposioRunTool({
			context: runContext,
			userId: 42,
			provider,
			operationId: "GMAIL_FETCH_EMAILS",
			arguments: {},
			sessionId: "ccs_opaque",
			scope: { completionId: "completion-1", recipeId: "gmail-recipe" },
		});
		mocks.deleteComposioToolSession.mockRejectedValueOnce(new Error("temporary failure"));

		await closeComposioConnectorRun(runContext);

		expect(mocks.markCleanupPending).toHaveBeenCalledWith({
			id: "ccs_opaque",
			cleanupAfter: expect.any(String),
		});
		expect(mocks.deleteRecord).not.toHaveBeenCalled();
	});

	it("does not let retry persistence failure escape request finalisation", async () => {
		const runContext = context();
		const provider = getConnectorProviderConfig("gmail")!;
		await executeComposioRunTool({
			context: runContext,
			userId: 42,
			provider,
			operationId: "GMAIL_FETCH_EMAILS",
			arguments: {},
			sessionId: "ccs_opaque",
			scope: { completionId: "completion-1" },
		});
		mocks.deleteComposioToolSession.mockRejectedValueOnce(new Error("temporary failure"));
		mocks.markCleanupPending.mockRejectedValueOnce(new Error("database unavailable"));

		await expect(closeComposioConnectorRun(runContext)).resolves.toBeUndefined();
	});

	it("does not initialise persistence when a run has no tracked sessions", async () => {
		const runContext = {
			env: testEnv,
			connectorRunId: "connector_run_empty",
			get repositories() {
				throw new Error("repositories should not be resolved");
			},
		} as never;

		await expect(closeComposioConnectorRun(runContext)).resolves.toBeUndefined();
	});
});
