import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ deleteExpired: vi.fn() }));

vi.mock("~/repositories", () => ({
  RepositoryManager: {
    getInstance: () => ({
      connectorOperationApprovals: { deleteExpired: mocks.deleteExpired },
    }),
  },
}));

import { deleteExpiredConnectorOperationApprovals } from "../connector-approval-cleanup";

describe("connector approval cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteExpired.mockResolvedValue(2);
  });

  it("retains resolved approval state for thirty days", async () => {
    await expect(
      deleteExpiredConnectorOperationApprovals({} as never, new Date("2026-08-13T14:00:00.000Z")),
    ).resolves.toBe(2);

    expect(mocks.deleteExpired).toHaveBeenCalledWith({
      pendingBefore: "2026-08-13T14:00:00.000Z",
      resolvedBefore: "2026-07-14T14:00:00.000Z",
    });
  });
});
