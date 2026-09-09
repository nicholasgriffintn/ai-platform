import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listExpiredHeldReservations: vi.fn(),
  finishUsageReservation: vi.fn(),
}));

vi.mock("~/repositories", () => ({
  RepositoryManager: class {
    usageReservations = {
      listExpiredHeldReservations: mocks.listExpiredHeldReservations,
    };
  },
}));

vi.mock("~/lib/usage/reservations", () => ({
  finishUsageReservation: mocks.finishUsageReservation,
}));

import { releaseExpiredChatRunReservations } from "../reservation-maintenance";

describe("releaseExpiredChatRunReservations", () => {
  beforeEach(() => {
    mocks.listExpiredHeldReservations.mockReset();
    mocks.finishUsageReservation.mockReset();
  });

  it("releases only the expired held reservations returned by the repository", async () => {
    mocks.listExpiredHeldReservations.mockResolvedValue([
      { id: "expired-1", ref_id: "run-1" },
      { id: "expired-2", ref_id: "run-2" },
    ]);
    mocks.finishUsageReservation
      .mockResolvedValueOnce({ ref_id: "run-1" })
      .mockResolvedValueOnce(null);

    await expect(
      releaseExpiredChatRunReservations({} as never, new Date("2026-09-06T10:00:00.000Z")),
    ).resolves.toBe(1);
    expect(mocks.listExpiredHeldReservations).toHaveBeenCalledWith(
      "chat_run",
      "2026-09-06T10:00:00.000Z",
      100,
    );
    expect(mocks.finishUsageReservation).toHaveBeenCalledTimes(2);
    expect(mocks.finishUsageReservation).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        refId: "run-1",
        reservationId: "expired-1",
        outcome: "released",
      }),
    );
    expect(mocks.finishUsageReservation).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        refId: "run-2",
        reservationId: "expired-2",
        outcome: "released",
      }),
    );
  });
});
