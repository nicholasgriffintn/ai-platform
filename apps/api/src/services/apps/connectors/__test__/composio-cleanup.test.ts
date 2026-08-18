import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listCleanupDue: vi.fn(),
  claimCleanup: vi.fn(),
  markCleanupPending: vi.fn(),
  deleteRecord: vi.fn(),
  deleteExpired: vi.fn(),
  deleteComposioToolSession: vi.fn(),
}));

vi.mock("~/repositories", () => ({
  RepositoryManager: {
    getInstance: () => ({
      composioConnectorSessions: {
        listCleanupDue: mocks.listCleanupDue,
        claimCleanup: mocks.claimCleanup,
        markCleanupPending: mocks.markCleanupPending,
        delete: mocks.deleteRecord,
      },
      connectorOperationApprovals: { deleteExpired: mocks.deleteExpired },
    }),
  },
}));

vi.mock("~/lib/providers/capabilities/connectors/composio/client", () => ({
  deleteComposioToolSession: mocks.deleteComposioToolSession,
}));

import { reapComposioConnectorSessions } from "../composio-cleanup";

describe("Composio connector session reaper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteComposioToolSession.mockResolvedValue(undefined);
    mocks.deleteRecord.mockResolvedValue(undefined);
  });

  it("deletes expired hosted connection sessions through the same durable cleanup path", async () => {
    const connectionSession = {
      id: "ccs_connection",
      remoteSessionId: "trs_connection",
      kind: "connection",
      cleanupAttempts: 0,
    };

    mocks.listCleanupDue.mockResolvedValueOnce([connectionSession]);
    mocks.claimCleanup.mockResolvedValueOnce(connectionSession);

    await expect(
      reapComposioConnectorSessions({} as never, new Date("2026-08-13T12:00:00.000Z")),
    ).resolves.toEqual({ deleted: 1, failed: 0 });
    expect(mocks.deleteComposioToolSession).toHaveBeenCalledWith({
      env: {},
      sessionId: "trs_connection",
    });
    expect(mocks.deleteRecord).toHaveBeenCalledWith("ccs_connection");
  });
});
